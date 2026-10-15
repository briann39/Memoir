import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import { FILTER, LOOSE, VIRTUAL } from '../keys'

// Navegar por las fotos: qué entradas de la barra lateral están abiertas, qué fotos tiene cada una
// y cuál se está viendo.
export function useBrowser({ virtualFiles, filterResults }) {
  const [expanded, setExpanded] = useState(() => new Set())
  const [filesByKey, setFilesByKey] = useState({}) // carpeta del disco -> sus fotos (se leen al abrirla)
  const [loose, setLoose] = useState([])
  const [selected, setSelected] = useState(null) // { key, index }

  const allFiles = useMemo(
    () => ({ ...filesByKey, [LOOSE]: loose, [FILTER]: filterResults, ...virtualFiles }),
    [filesByKey, loose, filterResults, virtualFiles],
  )

  // Para las operaciones largas, que siguen corriendo mientras las listas cambian
  const allFilesRef = useRef(allFiles)
  useEffect(() => {
    allFilesRef.current = allFiles
  }, [allFiles])

  const images = selected ? allFiles[selected.key] : null
  const current = images?.[selected.index]
  const persistent = Boolean(current) && selected.key !== LOOSE // es un archivo del disco, no una foto suelta

  const expand = (key) => setExpanded((prev) => new Set(prev).add(key))

  // Abre o cierra una entrada; las carpetas del disco leen sus fotos la primera vez
  const toggleFolder = async (entry) => {
    const abierta = expanded.has(entry.path)
    setExpanded((prev) => {
      const next = new Set(prev)
      if (abierta) next.delete(entry.path)
      else next.add(entry.path)
      return next
    })
    if (abierta || VIRTUAL.has(entry.kind) || filesByKey[entry.path]) return
    const fotos = await api.readFolder(entry.path)
    setFilesByKey((prev) => ({ ...prev, [entry.path]: fotos }))
  }

  const pick = (key, index) => setSelected({ key, index })

  const step = useCallback(
    (delta) =>
      setSelected((s) => {
        const total = s ? allFilesRef.current[s.key]?.length : 0
        if (!total) return s
        return { ...s, index: (s.index + delta + total) % total }
      }),
    [],
  )
  const prev = useCallback(() => step(-1), [step])
  const next = useCallback(() => step(1), [step])

  // Fotos sueltas: abiertas con «Abrir fotos» o arrastradas a la ventana
  const addFiles = (fileList) => {
    const nuevas = Array.from(fileList)
      .filter((file) => file.type.startsWith('image/'))
      .map((file) => ({ id: crypto.randomUUID(), name: file.name, url: URL.createObjectURL(file) }))
    if (!nuevas.length) return
    setSelected({ key: LOOSE, index: loose.length })
    setLoose((prev) => [...prev, ...nuevas])
    expand(LOOSE)
  }

  // Olvida las listas leídas del disco (por ejemplo al volver a buscar)
  const reset = () => {
    setExpanded(new Set())
    setFilesByKey({})
    setSelected(null)
  }

  // Obliga a leer de nuevo estas carpetas la próxima vez que se abran
  const invalidate = (dirs) =>
    setFilesByKey((prev) => Object.fromEntries(Object.entries(prev).filter(([dir]) => !dirs.has(dir))))

  // Quita fotos que ya no están en el disco de todas las listas y mantiene la selección en un sitio lógico
  const dropFiles = (files) => {
    const gone = new Set(files)
    setFilesByKey((prev) =>
      Object.fromEntries(Object.entries(prev).map(([key, list]) => [key, list.filter((i) => !gone.has(i.id))])),
    )
    setSelected((s) => {
      if (!s) return s
      const list = allFilesRef.current[s.key] ?? []
      const open = list[s.index]
      const kept = list.filter((i) => !gone.has(i.id))
      if (open && !gone.has(open.id)) {
        // sigue la misma foto, aunque cambie su posición en la lista
        return { ...s, index: kept.findIndex((i) => i.id === open.id) }
      }
      if (!kept.length) return null
      const before = list.slice(0, s.index).filter((i) => !gone.has(i.id)).length
      return { key: s.key, index: Math.min(before, kept.length - 1) }
    })
  }

  // Cierra la foto abierta si su carpeta desaparece de la barra lateral
  const closeIfIn = (key) => setSelected((s) => (s?.key === key ? null : s))

  return {
    expanded,
    allFiles,
    loose,
    selected,
    images,
    current,
    persistent,
    toggleFolder,
    expand,
    pick,
    prev,
    next,
    addFiles,
    reset,
    invalidate,
    dropFiles,
    closeIfIn,
  }
}
