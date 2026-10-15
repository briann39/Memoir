// Biblioteca del usuario: álbumes propios y etiquetas. Las fotos se identifican por su ruta en disco.

export const EMPTY_LIBRARY = { albums: [], tags: [], imageTags: {}, hiddenFolders: [], serverFolder: '', lastSubfolder: '' }

// Colores de etiquetas (clases completas para que Tailwind las detecte)
export const TAG_COLORS = [
  { chip: 'bg-sky-500/15 text-sky-300', active: 'bg-sky-500 text-white', dot: 'bg-sky-400' },
  { chip: 'bg-emerald-500/15 text-emerald-300', active: 'bg-emerald-500 text-white', dot: 'bg-emerald-400' },
  { chip: 'bg-amber-500/15 text-amber-300', active: 'bg-amber-500 text-white', dot: 'bg-amber-400' },
  { chip: 'bg-rose-500/15 text-rose-300', active: 'bg-rose-500 text-white', dot: 'bg-rose-400' },
  { chip: 'bg-violet-500/15 text-violet-300', active: 'bg-violet-500 text-white', dot: 'bg-violet-400' },
  { chip: 'bg-orange-500/15 text-orange-300', active: 'bg-orange-500 text-white', dot: 'bg-orange-400' },
]

const normalize = (lib) => ({
  albums: lib?.albums ?? [],
  tags: lib?.tags ?? [],
  imageTags: lib?.imageTags ?? {},
  hiddenFolders: lib?.hiddenFolders ?? [],
  serverFolder: lib?.serverFolder ?? '',
  lastSubfolder: lib?.lastSubfolder ?? '',
})

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
  try {
    if (window.electronAPI) window.electronAPI.saveLibrary(lib)
    else localStorage.setItem('library', JSON.stringify(lib))
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

export function addTag(lib, name) {
  const clean = name.trim()
  if (!clean || lib.tags.some((t) => t.name.toLowerCase() === clean.toLowerCase())) return lib
  const tag = { id: crypto.randomUUID(), name: clean, color: lib.tags.length % TAG_COLORS.length }
  return { ...lib, tags: [...lib.tags, tag] }
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

// Quita una foto eliminada de todos los álbumes y etiquetas
export function forgetImage(lib, file) {
  const imageTags = { ...lib.imageTags }
  delete imageTags[file]
  return {
    ...lib,
    imageTags,
    albums: lib.albums.map((a) => ({ ...a, images: a.images.filter((f) => f !== file) })),
  }
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
  if (!clean || lib.albums.some((a) => a.name.toLowerCase() === clean.toLowerCase())) return lib
  return { ...lib, albums: [...lib.albums, { id: crypto.randomUUID(), name: clean, images: [] }] }
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
