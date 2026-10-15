import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'

// Las carpetas con fotos que se encuentran en este equipo. startup: los ajustes al abrir la app
// (si hay que buscar y dónde); settings: los ajustes actuales, que usa «Buscar de nuevo».
export function usePcFolders({ startup, settings }) {
  const [folders, setFolders] = useState([])
  const [scanning, setScanning] = useState(Boolean(api))

  // Sin carpetas elegidas se busca en la carpeta del usuario
  const start = useCallback((roots) => {
    setScanning(true)
    api.startScan(roots?.length ? roots : undefined, 'pc')
  }, [])

  // Avisos de la búsqueda
  useEffect(() => {
    if (!api) return
    const offBatch = api.onScanBatch((channel, lote) => {
      if (channel !== 'pc') return
      setFolders((prev) => {
        const known = new Set(prev.map((f) => f.path))
        return [...prev, ...lote.filter((f) => !known.has(f.path))]
      })
    })
    const offDone = api.onScanDone((channel) => channel === 'pc' && setScanning(false))
    return () => {
      offBatch()
      offDone()
    }
  }, [])

  // La búsqueda inicial, cuando ya se conocen los ajustes
  useEffect(() => {
    if (!api || !startup) return
    if (startup.scanOnStart) api.startScan(startup.scanRoots.length ? startup.scanRoots : undefined, 'pc')
    else queueMicrotask(() => setScanning(false))
    return () => api.stopScan('pc')
  }, [startup])

  const rescan = () => {
    setFolders([])
    start(settings.scanRoots)
  }

  const stop = () => {
    api.stopScan('pc')
    setScanning(false)
  }

  // Busca también dentro de las carpetas que elija el usuario
  const addFolder = async () => {
    const roots = await api.selectFolders()
    if (roots.length) start(roots)
  }

  // Descuenta fotos que ya no están (enviadas o eliminadas) y quita las carpetas que quedan vacías
  const removeCounts = (files) =>
    setFolders((prev) => {
      const removed = {}
      for (const file of files) {
        const dir = file.replace(/[\\/][^\\/]*$/, '')
        removed[dir] = (removed[dir] ?? 0) + 1
      }
      return prev
        .map((f) => (removed[f.path] ? { ...f, count: f.count - removed[f.path] } : f))
        .filter((f) => f.count > 0)
    })

  // Suma una foto nueva (por ejemplo la copia de una edición) a su carpeta, si la carpeta ya está en la lista
  const addCount = (dir) => setFolders((prev) => prev.map((f) => (f.path === dir ? { ...f, count: f.count + 1 } : f)))

  return { folders, scanning, rescan, stop, addFolder, removeCounts, addCount }
}
