import { app, BrowserWindow, dialog, ipcMain, net, nativeImage, protocol, shell } from 'electron'
import { constants as fsConstants, realpath as realpathCallback } from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

// La versión «native» resuelve una unidad de red (Z:) a su ruta real \\servidor\carpeta
const realpathNative = promisify(realpathCallback.native)

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
// En el servidor solo se saltan las carpetas ocultas (como .memoir); sus álbumes pueden llamarse como quieran
const shouldSkip = (name, channel) =>
  name.startsWith('.') || name.startsWith('$') || (channel !== 'server' && SKIP_DIRS.has(name.toLowerCase()))

// Esquema propio para mostrar imágenes locales desde la página
protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
])

// Un archivo que solo está en la nube (iCloud, OneDrive) tiene tamaño pero no ocupa espacio en disco.
// Consultar sus metadatos no lo descarga; abrirlo sí. Solo aplica dentro de la carpeta del usuario:
// en una carpeta de red el tamaño en disco no es fiable.
const HOME = os.homedir().toLowerCase()
const isCloudOnly = (stat, file) =>
  process.platform === 'win32' && file.toLowerCase().startsWith(HOME) && stat.size > 0 && stat.blocks === 0

// Álbumes del servidor que usaba la versión anterior: Personas\nombre y Mascotas\nombre
const LEGACY_KINDS = { personas: 'persona', mascotas: 'mascota' }

// Carpeta oculta del servidor donde se guardan los datos de las fotos
const CATALOG_DIR = '.memoir'
const CATALOG_FILE = 'catalogo.json'

// La carpeta del servidor debe ser una ruta absoluta a la que se pueda llegar
async function checkServerDir(serverDir) {
  if (!path.isAbsolute(serverDir)) throw new Error('Elige primero la carpeta del servidor.')
  const stat = await fs.stat(serverDir).catch(() => null)
  if (!stat?.isDirectory()) {
    throw new Error('No se puede acceder a la carpeta del servidor. ¿Está encendido y conectado?')
  }
  return serverDir
}

// Nombre de una subcarpeta del servidor: sin rutas ni caracteres que Windows no admite
function safeFolderName(name) {
  const clean = String(name ?? '').trim()
  if (!clean) return ''
  if (clean.length > 100 || /[<>:"/\\|?*]/.test(clean) || /[. ]$/.test(clean) || clean.startsWith('.')) {
    throw new Error('Nombre de carpeta no válido. No uses / \\ : * ? " < > | ni empieces o termines en punto.')
  }
  return clean
}

// Imágenes (sin subcarpetas) de una carpeta, ya filtradas por tamaño
async function imagesIn(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const names = entries.filter((e) => e.isFile() && isImage(e.name)).map((e) => e.name)
  const stats = await Promise.all(names.map((n) => fs.stat(path.join(dir, n)).catch(() => null)))
  return names
    .map((name, i) => ({ name, stat: stats[i] }))
    .filter(({ stat }) => stat && stat.size >= MIN_BYTES)
    .map(({ name, stat }) => ({ name, cloud: isCloudOnly(stat, path.join(dir, name)) }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
}

// Una búsqueda a la vez por canal: 'pc' (el equipo) y 'server' (la carpeta del servidor)
const scans = new Map()

// Recorre el disco por niveles (las carpetas cercanas aparecen primero) y envía lotes de carpetas con fotos
async function scan(sender, roots, channel) {
  scans.get(channel)?.cancel()
  const token = { cancelled: false, cancel() { this.cancelled = true } }
  scans.set(channel, token)

  let pending = []
  const flush = () => {
    if (pending.length && !sender.isDestroyed()) sender.send('scan-batch', { channel, folders: pending })
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
      if (shouldSkip(e.name, channel)) continue
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
        const entry = { path: dir, name: path.basename(dir) || dir, count: imgs.length }
        if (channel === 'server') {
          // Los álbumes se muestran con su ruta dentro del servidor (por ejemplo "Viaje" o "Personas / Ana")
          const parts = path.relative(roots[0], dir).split(path.sep)
          entry.rel = parts.join('/')
          entry.name = parts.join(' / ')
          const kind = parts.length === 2 ? LEGACY_KINDS[parts[0].toLowerCase()] : null
          if (kind) {
            // Álbum de la versión anterior: se reconoce a la persona o mascota por el nombre de la carpeta
            entry.legacy = { kind, name: parts[1] }
            entry.files = imgs.map((img) => path.join(dir, img.name))
          }
        }
        pending.push(entry)
      }
    } catch {
      // carpeta ilegible: se ignora
    }
  }

  clearInterval(timer)
  flush()
  if (scans.get(channel) === token) scans.delete(channel)
  if (!token.cancelled && !sender.isDestroyed()) sender.send('scan-done', { channel })
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

  ipcMain.handle('scan-start', (event, roots, channel) => {
    scan(event.sender, roots?.length ? roots : [os.homedir()], channel === 'server' ? 'server' : 'pc')
  })

  ipcMain.handle('scan-stop', (_event, channel) => {
    scans.get(channel === 'server' ? 'server' : 'pc')?.cancel()
  })

  // Datos de las fotos del servidor (personas, mascotas, etiquetas), en una carpeta oculta del servidor.
  // catalog-load falla si no se llega al servidor: así la app nunca guarda un catálogo vacío encima del real.
  ipcMain.handle('catalog-load', async (_event, serverDir) => {
    const file = path.join(await checkServerDir(serverDir), CATALOG_DIR, CATALOG_FILE)
    let text
    try {
      text = await fs.readFile(file, 'utf8')
    } catch {
      return null // todavía no existe
    }
    try {
      return JSON.parse(text)
    } catch {
      await fs.copyFile(file, file + '.bak') // archivo dañado: se conserva una copia
      return null
    }
  })

  ipcMain.handle('catalog-save', async (_event, serverDir, catalog) => {
    const dir = path.join(await checkServerDir(serverDir), CATALOG_DIR)
    await fs.mkdir(dir, { recursive: true })
    const file = path.join(dir, CATALOG_FILE)
    await fs.writeFile(file + '.tmp', JSON.stringify(catalog))
    await fs.rename(file + '.tmp', file)
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
      return { exists: true, cloud: isCloudOnly(await fs.stat(file), file) }
    } catch {
      return { exists: false, cloud: false }
    }
  })

  // Vista previa de una foto. Windows la pide a la miniatura que ya tiene (o que le da iCloud),
  // así que no descarga la foto completa.
  ipcMain.handle('thumbnail', async (_event, file, size) => {
    if (!path.isAbsolute(file) || !isImage(file) || !nativeImage.createThumbnailFromPath) return null
    try {
      const thumb = await nativeImage.createThumbnailFromPath(file, { width: size, height: size })
      return 'data:image/jpeg;base64,' + thumb.toJPEG(85).toString('base64')
    } catch {
      return null
    }
  })

  // Copia la foto al álbum (carpeta) del servidor y, si se pide, la mueve: la original va a la Papelera
  // solo cuando la copia quedó completa. Devuelve la ruta nueva de la foto.
  ipcMain.handle('send-to-server', async (_event, file, serverDir, album, move) => {
    if (!path.isAbsolute(file) || !isImage(file)) throw new Error('Ruta no válida')
    const folder = safeFolderName(album)
    if (!folder) throw new Error('Falta el nombre del álbum')
    const destDir = path.join(await checkServerDir(serverDir), folder)
    const origen = await fs.stat(file).catch(() => null)
    if (!origen) throw new Error('SOURCE_MISSING')

    await fs.mkdir(destDir, { recursive: true })
    const ext = path.extname(file)
    const base = path.basename(file, ext)
    let target = path.join(destDir, base + ext)
    for (let n = 1; await fs.stat(target).then(() => true, () => false); n++) {
      target = path.join(destDir, `${base} (${n})${ext}`) // no pisa fotos que ya estén en el servidor
    }
    try {
      await fs.copyFile(file, target, fsConstants.COPYFILE_EXCL)
      if ((await fs.stat(target)).size !== origen.size) {
        throw new Error('La copia no coincide con la original. No se movió nada.')
      }
    } catch (err) {
      await fs.rm(target, { force: true })
      throw err
    }
    if (move) {
      try {
        await shell.trashItem(file)
      } catch {
        throw new Error('La foto se copió al servidor, pero no se pudo enviar la original a la Papelera.')
      }
    }
    return target
  })

  // Manda la foto a la Papelera de reciclaje. En una carpeta sincronizada, la nube también la elimina.
  // En una carpeta de red no hay Papelera: Windows borraría la foto para siempre, así que no se permite.
  ipcMain.handle('trash-file', async (_event, file) => {
    if (!path.isAbsolute(file) || !isImage(file)) throw new Error('Archivo no permitido')
    const real = await realpathNative(file).catch(() => file)
    if (real.startsWith('\\\\')) throw new Error('Las fotos del servidor no se pueden eliminar desde la app.')
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
