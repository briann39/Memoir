import { app, BrowserWindow, dialog, ipcMain, net, protocol, shell } from 'electron'
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

// Un archivo que solo está en la nube (iCloud, OneDrive) tiene tamaño pero no ocupa espacio en disco.
// Consultar sus metadatos no lo descarga; abrirlo sí.
const isCloudOnly = (stat) => process.platform === 'win32' && stat.size > 0 && stat.blocks === 0

// Imágenes (sin subcarpetas) de una carpeta, ya filtradas por tamaño
async function imagesIn(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const names = entries.filter((e) => e.isFile() && isImage(e.name)).map((e) => e.name)
  const stats = await Promise.all(names.map((n) => fs.stat(path.join(dir, n)).catch(() => null)))
  return names
    .map((name, i) => ({ name, stat: stats[i] }))
    .filter(({ stat }) => stat && stat.size >= MIN_BYTES)
    .map(({ name, stat }) => ({ name, cloud: isCloudOnly(stat) }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
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
  const seen = new Set(roots.map((r) => r.toLowerCase())) // evita repetir carpetas y bucles de enlaces
  for (let i = 0; i < queue.length && !token.cancelled; i++) {
    const dir = queue[i]
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      continue // sin permisos o no existe
    }
    for (const e of entries) {
      if (shouldSkip(e.name)) continue
      const full = path.join(dir, e.name)
      let target = full
      if (e.isSymbolicLink()) {
        // iCloud Photos expone su carpeta de fotos como enlace
        try {
          if (!(await fs.stat(full)).isDirectory()) continue
          target = await fs.realpath(full)
        } catch {
          continue
        }
      } else if (!e.isDirectory()) {
        continue
      }
      const key = target.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      queue.push(full)
    }
    try {
      const imgs = await imagesIn(dir)
      if (imgs.length) {
        pending.push({
          path: dir,
          name: path.basename(dir) || dir,
          count: imgs.length,
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

  // Álbumes y etiquetas del usuario, guardados en la carpeta de datos de la app
  const libraryFile = path.join(app.getPath('userData'), 'library.json')

  ipcMain.handle('library-load', async () => {
    let text
    try {
      text = await fs.readFile(libraryFile, 'utf8')
    } catch {
      return null // todavía no existe
    }
    try {
      return JSON.parse(text)
    } catch {
      await fs.copyFile(libraryFile, libraryFile + '.bak') // archivo dañado: se conserva una copia
      return null
    }
  })

  ipcMain.handle('library-save', async (_event, library) => {
    const tmp = libraryFile + '.tmp'
    await fs.writeFile(tmp, JSON.stringify(library, null, 2))
    await fs.rename(tmp, libraryFile)
  })

  ipcMain.handle('read-folder', async (_event, folder) => {
    const imgs = await imagesIn(folder)
    return imgs.map(({ name, cloud }) => {
      const full = path.join(folder, name)
      return { id: full, name, url: mediaUrl(full), cloud }
    })
  })

  // Estado de una foto sin abrirla: si existe y si solo está en la nube
  ipcMain.handle('file-info', async (_event, file) => {
    if (!isImage(file)) return { exists: false, cloud: false }
    try {
      return { exists: true, cloud: isCloudOnly(await fs.stat(file)) }
    } catch {
      return { exists: false, cloud: false }
    }
  })

  // Manda la foto a la Papelera de reciclaje. En una carpeta sincronizada, la nube también la elimina.
  ipcMain.handle('trash-file', async (_event, file) => {
    if (!path.isAbsolute(file) || !isImage(file)) throw new Error('Archivo no permitido')
    await shell.trashItem(file)
  })

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
