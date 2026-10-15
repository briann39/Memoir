// Genera los iconos de la app a partir de build/icon.svg.
// Uso (desde la carpeta del proyecto):  npx electron scripts/make-icons.cjs
// Si el terminal define ELECTRON_RUN_AS_NODE, quítalo antes: Electron lo necesita para abrir ventanas.
const { app, BrowserWindow } = require('electron')
const os = require('node:os')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const svg = fs.readFileSync(path.join(root, 'build', 'icon.svg'), 'utf8')
const SIZES = [16, 24, 32, 48, 64, 128, 256, 512]

// Dibuja el SVG en una ventana invisible y la captura como PNG con transparencia
async function render(size) {
  const win = new BrowserWindow({
    show: false,
    width: size,
    height: size,
    useContentSize: true,
    frame: false,
    transparent: true,
  })
  const html = `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`
  const page = path.join(os.tmpdir(), `memoir-icon-${size}.html`)
  fs.writeFileSync(page, html)
  await win.loadFile(page)
  await new Promise((resolve) => setTimeout(resolve, 150))
  const image = await win.webContents.capturePage()
  win.destroy()
  return image.resize({ width: size, height: size, quality: 'best' }).toPNG()
}

// Un .ico es un contenedor: una cabecera y, por cada tamaño, una entrada que apunta a su PNG
function ico(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(1, 2) // tipo: icono
  header.writeUInt16LE(images.length, 4)
  const entries = Buffer.alloc(16 * images.length)
  let offset = header.length + entries.length
  images.forEach(({ size, png }, i) => {
    const at = i * 16
    entries[at] = size >= 256 ? 0 : size // 0 significa 256
    entries[at + 1] = size >= 256 ? 0 : size
    entries.writeUInt16LE(1, at + 4) // planos
    entries.writeUInt16LE(32, at + 6) // bits por píxel
    entries.writeUInt32LE(png.length, at + 8)
    entries.writeUInt32LE(offset, at + 12)
    offset += png.length
  })
  return Buffer.concat([header, entries, ...images.map(({ png }) => png)])
}

// Sin esto, Electron se cierra al destruir la primera ventana invisible
app.on('window-all-closed', () => {})

app.whenReady().then(async () => {
  const images = []
  for (const size of SIZES) images.push({ size, png: await render(size) })
  const out = path.join(root, 'build')
  fs.writeFileSync(path.join(out, 'icon.png'), images.find((i) => i.size === 512).png)
  fs.writeFileSync(path.join(out, 'icon.ico'), ico(images.filter((i) => i.size <= 256)))
  fs.copyFileSync(path.join(out, 'icon.svg'), path.join(root, 'public', 'favicon.svg'))
  console.log('Iconos listos en build/ y public/favicon.svg')
  app.quit()
})
