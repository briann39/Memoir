// Biblioteca del usuario: álbumes propios y etiquetas. Las fotos se identifican por su ruta en disco.

// Lo que el usuario puede cambiar en Configuración
export const DEFAULT_SETTINGS = {
  theme: 'system', // 'system' | 'light' | 'dark'
  minKb: 10, // no mostrar fotos más pequeñas (iconos, miniaturas)
  scanOnStart: true, // buscar fotos en el equipo al abrir la app
  scanRoots: [], // carpetas donde buscar; vacío = la carpeta del usuario
  jpegQuality: 92, // calidad al guardar fotos editadas (50 a 100)
  saveMode: 'copy', // 'copy': guardar una copia · 'replace': reemplazar la original
}

export const EMPTY_LIBRARY = {
  settings: DEFAULT_SETTINGS,
  albums: [],
  tags: [],
  imageTags: {},
  hiddenFolders: [],
  serverFolder: '',
  importedFolders: [],
  toDelete: [], // fotos marcadas para eliminar; se borran juntas cuando el usuario lo confirma
}

export const setSetting = (lib, key, value) => ({ ...lib, settings: { ...lib.settings, [key]: value } })

export const resetSettings = (lib) => ({ ...lib, settings: DEFAULT_SETTINGS })

// Álbum al que va una foto que se envía sin estar en ningún álbum de la app
export const NO_ALBUM = 'Sin álbum'

// Colores que se pueden dar a una etiqueta, persona o mascota. Los valores reales (para tema claro y
// oscuro) están en index.css como --tag-1 … --tag-8.
export const TAG_COLORS = ['Azul', 'Verde', 'Ámbar', 'Rosa', 'Violeta', 'Turquesa', 'Naranja', 'Grafito']

// El color de una etiqueta como valor de CSS
export const tagColor = (tag) => `var(--tag-${(tag.color ?? 0) % TAG_COLORS.length + 1})`

const normalize = (lib) => ({
  settings: { ...DEFAULT_SETTINGS, ...lib?.settings },
  albums: lib?.albums ?? [],
  tags: lib?.tags ?? [],
  imageTags: lib?.imageTags ?? {},
  hiddenFolders: lib?.hiddenFolders ?? [],
  serverFolder: lib?.serverFolder ?? '',
  importedFolders: lib?.importedFolders ?? [],
  toDelete: lib?.toDelete ?? [],
})

// ---- Fotos del servidor ----
// Los datos de las fotos del servidor (personas, mascotas, etiquetas) se guardan en el propio servidor,
// con la ruta relativa de cada foto; en la app se ven como cualquier otra foto, por su ruta completa.

const norm = (p) => p.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase()

export function isServerPath(lib, file) {
  return Boolean(lib.serverFolder) && norm(file).startsWith(norm(lib.serverFolder) + '\\')
}

const relOf = (lib, file) => file.slice(norm(lib.serverFolder).length + 1).replace(/\\/g, '/')
const absOf = (lib, rel) => lib.serverFolder.replace(/[\\/]+$/, '') + '\\' + rel.replace(/\//g, '\\')

// Lo que se guarda en el servidor: las etiquetas y los datos de las fotos que están allí
export function buildCatalog(lib) {
  const photos = {}
  for (const [file, ids] of Object.entries(lib.imageTags)) {
    if (isServerPath(lib, file)) photos[relOf(lib, file)] = ids
  }
  return { version: 1, tags: lib.tags, photos, importedFolders: lib.importedFolders }
}

// Une los datos del servidor con los de la app. Las etiquetas se reconocen por tipo y nombre,
// porque cada instalación les pone un id distinto.
export function mergeCatalog(lib, catalog) {
  if (!catalog) return lib
  const tags = [...lib.tags]
  const ids = {}
  for (const tag of catalog.tags ?? []) {
    const mine = tags.find((t) => kindOf(t) === kindOf(tag) && t.name.toLowerCase() === tag.name.toLowerCase())
    if (mine) ids[tag.id] = mine.id
    else {
      tags.push({ ...tag })
      ids[tag.id] = tag.id
    }
  }
  const imageTags = { ...lib.imageTags }
  for (const [rel, tagIds] of Object.entries(catalog.photos ?? {})) {
    const mapped = [...new Set(tagIds.map((id) => ids[id]).filter(Boolean))]
    if (mapped.length) imageTags[absOf(lib, rel)] = mapped
  }
  const importedFolders = [...new Set([...lib.importedFolders, ...(catalog.importedFolders ?? [])])]
  return { ...lib, tags, imageTags, importedFolders }
}

// Una carpeta del servidor de la versión anterior (Personas\Ana, Mascotas\Luna) se reconoce una sola vez:
// sus fotos quedan con el dato de la persona o mascota, sin moverlas.
export function importLegacyFolder(lib, folder) {
  if (lib.importedFolders.includes(folder.rel)) return lib
  const { kind, name } = folder.legacy
  const withTag = addTag(lib, name, kind)
  const tag = withTag.tags.find((t) => kindOf(t) === kind && t.name.toLowerCase() === name.toLowerCase())
  const imageTags = { ...withTag.imageTags }
  for (const file of folder.files) {
    const ids = imageTags[file] ?? []
    if (!ids.includes(tag.id)) imageTags[file] = [...ids, tag.id]
  }
  return { ...withTag, imageTags, importedFolders: [...withTag.importedFolders, folder.rel] }
}

// Pasa los datos de fotos que cambiaron de ruta (al enviarlas al servidor)
export function moveMeta(lib, moves) {
  const imageTags = { ...lib.imageTags }
  for (const { from, to } of moves) {
    if (imageTags[from]) {
      imageTags[to] = imageTags[from]
      delete imageTags[from]
    }
  }
  return { ...lib, imageTags }
}

// Nombre válido para una carpeta de Windows (los álbumes son carpetas del servidor)
export const validFolderName = (name) => {
  const clean = name.trim()
  return Boolean(clean) && clean.length <= 100 && !/[<>:"/\\|?*]/.test(clean) && !/[. ]$/.test(clean) && !clean.startsWith('.')
}

// En Electron se guarda en un archivo de la app; en el navegador, en localStorage
export async function loadLibrary() {
  try {
    if (window.electronAPI) return normalize(await window.electronAPI.loadLibrary())
    return normalize(JSON.parse(localStorage.getItem('library')))
  } catch {
    return normalize(null)
  }
}

export function saveLibrary(lib) {
  // Los datos de las fotos del servidor viven en el servidor, no en este archivo
  const local = {
    ...lib,
    imageTags: Object.fromEntries(Object.entries(lib.imageTags).filter(([file]) => !isServerPath(lib, file))),
  }
  try {
    if (window.electronAPI) window.electronAPI.saveLibrary(local)
    else localStorage.setItem('library', JSON.stringify(local))
  } catch {
    // sin almacenamiento disponible: los cambios solo duran la sesión
  }
}

export function imageFromPath(file) {
  return {
    id: file,
    name: file.split(/[\\/]/).pop(),
    url: `media://local/?p=${encodeURIComponent(file)}`,
  }
}

const toggle = (list, item) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item])

// Una etiqueta es normal ('tag'), una persona o una mascota. Las dos últimas son los destinos del servidor.
export const kindOf = (tag) => tag.kind ?? 'tag'

export function addTag(lib, name, kind = 'tag') {
  const clean = name.trim()
  const repetida = lib.tags.some((t) => kindOf(t) === kind && t.name.toLowerCase() === clean.toLowerCase())
  if (!clean || repetida) return lib
  // Cada una nace con el color que menos se usa, para que se distingan entre sí
  const uses = TAG_COLORS.map((_, color) => lib.tags.filter((t) => (t.color ?? 0) % TAG_COLORS.length === color).length)
  const color = uses.indexOf(Math.min(...uses))
  const tag = { id: crypto.randomUUID(), name: clean, kind, color }
  return { ...lib, tags: [...lib.tags, tag] }
}

export function setTagColor(lib, tagId, color) {
  return { ...lib, tags: lib.tags.map((t) => (t.id === tagId ? { ...t, color } : t)) }
}

// Las personas y mascotas indicadas en una foto
export function peopleOf(lib, file) {
  const ids = lib.imageTags[file] ?? []
  return lib.tags.filter((t) => kindOf(t) !== 'tag' && ids.includes(t.id))
}

// Fotos de este equipo listas para enviar: las que están en un álbum de la app o tienen una persona o
// mascota. Cada una va a la carpeta del servidor con el nombre de su álbum (la primera, si está en varias).
export function sendPlan(lib) {
  const people = new Set(lib.tags.filter((t) => kindOf(t) !== 'tag').map((t) => t.id))
  const albumOf = new Map()
  for (const album of lib.albums) {
    for (const file of album.images) if (!albumOf.has(file)) albumOf.set(file, album.name)
  }
  const files = new Set(albumOf.keys())
  for (const [file, ids] of Object.entries(lib.imageTags)) {
    if (ids.some((id) => people.has(id))) files.add(file)
  }
  return [...files]
    .filter((file) => !isServerPath(lib, file) && !lib.toDelete.includes(file))
    .map((file) => ({ file, album: albumOf.get(file) ?? NO_ALBUM }))
    .sort((a, b) => a.file.localeCompare(b.file))
}

export function removeTag(lib, tagId) {
  const imageTags = {}
  for (const [file, ids] of Object.entries(lib.imageTags)) {
    const rest = ids.filter((id) => id !== tagId)
    if (rest.length) imageTags[file] = rest
  }
  return { ...lib, tags: lib.tags.filter((t) => t.id !== tagId), imageTags }
}

export function toggleImageTag(lib, file, tagId) {
  const ids = toggle(lib.imageTags[file] ?? [], tagId)
  const imageTags = { ...lib.imageTags }
  if (ids.length) imageTags[file] = ids
  else delete imageTags[file]
  return { ...lib, imageTags }
}

// Quita una foto eliminada de todos los álbumes, etiquetas y marcas
export function forgetImage(lib, file) {
  const imageTags = { ...lib.imageTags }
  delete imageTags[file]
  return {
    ...lib,
    imageTags,
    albums: lib.albums.map((a) => ({ ...a, images: a.images.filter((f) => f !== file) })),
    toDelete: lib.toDelete.filter((f) => f !== file),
  }
}

// Marca o desmarca una foto para eliminarla después; no se borra nada todavía
export function toggleDelete(lib, file) {
  return { ...lib, toDelete: toggle(lib.toDelete, file) }
}

export function clearDeleteMarks(lib) {
  return { ...lib, toDelete: [] }
}

// Carpetas descartadas del visor (no se borran del disco)
export function hideFolder(lib, folder) {
  return lib.hiddenFolders.includes(folder) ? lib : { ...lib, hiddenFolders: [...lib.hiddenFolders, folder] }
}

export function restoreFolder(lib, folder) {
  return { ...lib, hiddenFolders: lib.hiddenFolders.filter((f) => f !== folder) }
}

export function addAlbum(lib, name) {
  const clean = name.trim()
  if (!validFolderName(clean) || lib.albums.some((a) => a.name.toLowerCase() === clean.toLowerCase())) {
    return lib
  }
  return { ...lib, albums: [...lib.albums, { id: crypto.randomUUID(), name: clean, images: [] }] }
}

// Por qué un nombre no sirve para un álbum nuevo (los álbumes son carpetas del servidor), o null si sirve
export function albumProblem(lib, name) {
  if (!validFolderName(name)) return 'No uses / \\ : * ? " < > | ni empieces o termines con un punto.'
  if (lib.albums.some((a) => a.name.toLowerCase() === name.toLowerCase())) return 'Ya existe un álbum con ese nombre.'
  return null
}

export function removeAlbum(lib, albumId) {
  return { ...lib, albums: lib.albums.filter((a) => a.id !== albumId) }
}

export function addToAlbum(lib, albumId, file) {
  return {
    ...lib,
    albums: lib.albums.map((a) =>
      a.id === albumId && !a.images.includes(file) ? { ...a, images: [...a.images, file] } : a,
    ),
  }
}

export function toggleInAlbum(lib, albumId, file) {
  return {
    ...lib,
    albums: lib.albums.map((a) => (a.id === albumId ? { ...a, images: toggle(a.images, file) } : a)),
  }
}
