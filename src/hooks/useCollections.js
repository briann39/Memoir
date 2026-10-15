import { useMemo, useState } from 'react'
import { FILTER } from '../keys'
import { imageFromPath, kindOf } from '../library'

const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })

// Lo que se deduce de la biblioteca: el contenido de cada álbum y de cada etiqueta, las personas,
// y el filtro «Buscar por personas» con su resultado.
export function useCollections(library) {
  const [filterIds, setFilterIds] = useState([]) // personas o mascotas elegidas para filtrar
  const [filterMode, setFilterMode] = useState('all') // 'all': salen todas · 'any': sale alguna

  // El contenido de cada álbum de la app y de cada etiqueta
  const virtualFiles = useMemo(() => {
    const map = {}
    for (const album of library.albums) map[`album:${album.id}`] = album.images.map(imageFromPath)
    for (const tag of library.tags) map[`tag:${tag.id}`] = []
    for (const [file, ids] of Object.entries(library.imageTags)) {
      for (const id of ids) map[`tag:${id}`]?.push(imageFromPath(file))
    }
    for (const tag of library.tags) map[`tag:${tag.id}`].sort(byName)
    return map
  }, [library])

  const albumEntries = useMemo(
    () =>
      library.albums.map((a) => ({
        path: `album:${a.id}`,
        name: a.name,
        count: a.images.length,
        kind: 'album',
        albumId: a.id,
      })),
    [library.albums],
  )

  const tagEntries = useMemo(
    () =>
      library.tags.map((t) => ({
        path: `tag:${t.id}`,
        name: t.name,
        count: virtualFiles[`tag:${t.id}`].length,
        kind: kindOf(t),
        color: t.color,
      })),
    [library.tags, virtualFiles],
  )

  // Personas y mascotas
  const people = useMemo(() => library.tags.filter((t) => kindOf(t) !== 'tag'), [library.tags])

  // Las primeras nueve tienen atajo de teclado (1 a 9): primero las personas y luego las mascotas
  const numbered = useMemo(() => {
    const ordered = [...people.filter((t) => kindOf(t) === 'persona'), ...people.filter((t) => kindOf(t) === 'mascota')]
    return new Map(ordered.slice(0, 9).map((t, i) => [t.id, i + 1]))
  }, [people])

  // Fotos donde salen todas las elegidas, o alguna de ellas
  const activeFilter = useMemo(
    () => filterIds.filter((id) => people.some((t) => t.id === id)),
    [filterIds, people],
  )
  const filterResults = useMemo(() => {
    if (!activeFilter.length) return []
    const match = filterMode === 'all' ? 'every' : 'some'
    return Object.entries(library.imageTags)
      .filter(([, ids]) => activeFilter[match]((id) => ids.includes(id)))
      .map(([file]) => imageFromPath(file))
      .sort(byName)
  }, [library.imageTags, activeFilter, filterMode])
  const filterEntry = activeFilter.length
    ? { path: FILTER, name: 'Resultado', count: filterResults.length, kind: 'filter' }
    : null

  const toggleFilter = (tagId) =>
    setFilterIds((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]))

  return {
    virtualFiles,
    albumEntries,
    tagEntries,
    people,
    numbered,
    filterIds: activeFilter,
    filterMode,
    filterEntry,
    filterResults,
    toggleFilter,
    setFilterMode,
  }
}
