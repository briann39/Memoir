// Edición de fotos: el estado de la edición y cómo se dibuja. No toca el archivo original:
// la foto se carga, se dibuja con los cambios en un canvas y solo entonces se guarda.

// Solo se editan los formatos que se pueden reescribir sin perder nada importante (no los animados)
export const EDITABLE = /\.(jpe?g|png|webp)$/i

export const FILTERS = [
  ['none', 'Original', ''],
  ['bn', 'Blanco y negro', 'grayscale(1)'],
  ['sepia', 'Sepia', 'sepia(0.85)'],
  ['calido', 'Cálido', 'sepia(0.3) saturate(1.25) hue-rotate(-10deg)'],
  ['frio', 'Frío', 'saturate(1.1) hue-rotate(14deg) brightness(1.02)'],
  ['vivo', 'Vivo', 'saturate(1.55) contrast(1.1)'],
]

// Proporciones de recorte: [clave, texto, ancho/alto en píxeles]. null = libre; 'orig' = la de la foto.
export const ASPECTS = [
  ['free', 'Libre', null],
  ['orig', 'Original', 'orig'],
  ['1:1', '1:1', 1],
  ['4:3', '4:3', 4 / 3],
  ['3:4', '3:4', 3 / 4],
  ['3:2', '3:2', 3 / 2],
  ['2:3', '2:3', 2 / 3],
  ['16:9', '16:9', 16 / 9],
  ['9:16', '9:16', 9 / 16],
]

// crop: { x, y, w, h } como fracciones (0 a 1) de la foto ya girada y volteada
export const initialEdit = () => ({
  rotation: 0, // 0, 90, 180 o 270 grados
  flipH: false,
  flipV: false,
  crop: null,
  aspect: 'free',
  brightness: 0, // -100 a 100
  contrast: 0,
  saturation: 0,
  filter: 'none',
})

export const isEdited = (edit) => JSON.stringify(edit) !== JSON.stringify(initialEdit())

export function filterString(edit) {
  const preset = FILTERS.find(([key]) => key === edit.filter)?.[2] ?? ''
  return `brightness(${1 + edit.brightness / 100}) contrast(${1 + edit.contrast / 100}) saturate(${1 + edit.saturation / 100}) ${preset}`.trim()
}

// Tamaño de la foto después de girarla
export const rotatedSize = (width, height, edit) => (edit.rotation % 180 === 0 ? [width, height] : [height, width])

// Tamaño final en píxeles, con el recorte
export function outputSize(width, height, edit) {
  const [rw, rh] = rotatedSize(width, height, edit)
  if (!edit.crop) return [rw, rh]
  return [Math.max(1, Math.round(edit.crop.w * rw)), Math.max(1, Math.round(edit.crop.h * rh))]
}

// Dibuja la foto girada, volteada y con los ajustes (sin recortar). scale < 1 para la vista previa.
export function renderTransformed(bitmap, edit, scale = 1) {
  const [rw, rh] = rotatedSize(bitmap.width, bitmap.height, edit)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(rw * scale))
  canvas.height = Math.max(1, Math.round(rh * scale))
  const ctx = canvas.getContext('2d')
  ctx.filter = filterString(edit)
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.scale(edit.flipH ? -1 : 1, edit.flipV ? -1 : 1) // el volteo se aplica sobre la foto ya girada
  ctx.rotate((edit.rotation * Math.PI) / 180)
  ctx.drawImage(bitmap, (-bitmap.width * scale) / 2, (-bitmap.height * scale) / 2, bitmap.width * scale, bitmap.height * scale)
  return canvas
}

// La foto final, a tamaño completo y recortada
export function renderOutput(bitmap, edit) {
  const full = renderTransformed(bitmap, edit, 1)
  if (!edit.crop) return full
  const sx = Math.round(edit.crop.x * full.width)
  const sy = Math.round(edit.crop.y * full.height)
  const sw = Math.max(1, Math.min(full.width - sx, Math.round(edit.crop.w * full.width)))
  const sh = Math.max(1, Math.min(full.height - sy, Math.round(edit.crop.h * full.height)))
  const out = document.createElement('canvas')
  out.width = sw
  out.height = sh
  out.getContext('2d').drawImage(full, sx, sy, sw, sh, 0, 0, sw, sh)
  return out
}

const clamp = (value, min = 0, max = 1) => Math.min(Math.max(value, min), max)

// El recorte más grande, centrado, con esa proporción (ancho/alto en píxeles) dentro de una foto rw × rh
export function aspectCrop(ratio, rw, rh) {
  let w = 1
  let h = rw / ratio / rh
  if (h > 1) {
    h = 1
    w = (ratio * rh) / rw
  }
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h }
}

// El recorte que va desde un punto fijo (anchor) hasta el puntero, con proporción libre (ratio = null) o fija
export function cropFromAnchor(anchor, point, ratio, rw, rh) {
  const dirX = point.x >= anchor.x ? 1 : -1
  const dirY = point.y >= anchor.y ? 1 : -1
  let w = Math.abs(point.x - anchor.x)
  let h = Math.abs(point.y - anchor.y)
  if (ratio) {
    const maxW = dirX > 0 ? 1 - anchor.x : anchor.x
    const maxH = dirY > 0 ? 1 - anchor.y : anchor.y
    w = Math.min(w, maxW, (maxH * ratio * rh) / rw)
    h = (w * rw) / (ratio * rh)
  }
  return {
    x: dirX > 0 ? anchor.x : anchor.x - w,
    y: dirY > 0 ? anchor.y : anchor.y - h,
    w: clamp(w),
    h: clamp(h),
  }
}

// Mueve un recorte sin que se salga de la foto
export const moveCrop = (crop, dx, dy) => ({
  ...crop,
  x: clamp(crop.x + dx, 0, 1 - crop.w),
  y: clamp(crop.y + dy, 0, 1 - crop.h),
})

export { clamp }
