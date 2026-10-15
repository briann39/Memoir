import { app, BrowserWindow, dialog, ipcMain, net, protocol } from 'electron'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const devUrl = process.env.VITE_DEV_SERVER_URL
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.avif'])
// Ignora iconos y miniaturas muy pequeñas
const MIN_BYTES = 10 * 1024
// Carpetas del sistema o de aplicaciones que no contienen fotos del usuario
const SKIP_DIRS = new Set([
  'appdata', 'application data', 'local settings', 'node_modules', '$recycle.bin',
  'windows', 'program files', 'program files (x86)', 'programdata', 'system volume information',
  'cookies', 'nethood', 'printhood', 'recent', 'sendto', 'start menu', 'templates', 'thumbnails',
])

const isImage = (file) => IMAGE_EXT.has(path.extname(file).toLowerCase())
const mediaUrl = (file) => `media://local/?p=${encodeURIComponent(file)}`
const shouldSkip = (name) => name.startsWith('.') || SKIP_DIRS.has(name.toLowerCase())

// Esquema propio para mostrar imágenes locales desde la página
protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
])

// Imágenes (sin subcarpetas) de una carpeta, ya filtradas por tamaño
async function imagesIn(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const names = entries.filter((e) => e.isFile() && isImage(e.name)).map((e) => e.name)
  const sizes = await Promise.all(
    names.map((n) => fs.stat(path.join(dir, n)).then((s) => s.size).catch(() => 0)),
  )
  return names
    .filter((_, i) => sizes[i] >= MIN_BYTES)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

let currentScan = null

// Recorre el disco por niveles (las carpetas cercanas aparecen primero) y envía lotes de carpetas con fotos
async function scan(sender, roots) {
  if (currentScan) currentScan.cancelled = true
  const token = { cancelled: false }
  currentScan = token

  let pending = []
  const flush = () => {
    if (pending.length && !sender.isDestroyed()) sender.send('scan-batch', pending)
    pending = []
  }
  const timer = setInterval(flush, 300)

  const queue = [...roots]
  for (let i = 0; i < queue.length && !token.cancelled; i++) {
    const dir = queue[i]
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      continue // sin permisos o no existe
    }
    for (const e of entries) {
      if (e.isDirectory() && !e.isSymbolicLink() && !shouldSkip(e.name)) {
        queue.push(path.join(dir, e.name))
      }
    }
    try {
      const imgs = await imagesIn(dir)
      if (imgs.length) {
        pending.push({
          path: dir,
          name: path.basename(dir) || dir,
          count: imgs.length,
          cover: mediaUrl(path.join(dir, imgs[0])),
        })
      }
    } catch {
      // carpeta ilegible: se ignora
    }
  }

  clearInterval(timer)
  flush()
  if (currentScan === token) currentScan = null
  if (!token.cancelled && !sender.isDestroyed()) sender.send('scan-done')
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (devUrl) {
    win.loadURL(devUrl)
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  protocol.handle('media', (request) => {
    const file = new URL(request.url).searchParams.get('p')
    if (!file || !isImage(file)) return new Response('Forbidden', { status: 403 })
    return net.fetch(pathToFileURL(file).href)
  })

  ipcMain.handle('select-folders', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Seleccionar carpetas',
      properties: ['openDirectory', 'multiSelections'],
    })
    return canceled ? [] : filePaths
  })

  ipcMain.handle('scan-start', (event, roots) => {
    scan(event.sender, roots?.length ? roots : [os.homedir()])
  })

  ipcMain.handle('scan-stop', () => {
    if (currentScan) currentScan.cancelled = true
  })

  ipcMain.handle('read-folder', async (_event, folder) => {
    const names = await imagesIn(folder)
    return names.map((name) => {
      const full = path.join(folder, name)
      return { id: full, name, url: mediaUrl(full) }
    })
  })

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
