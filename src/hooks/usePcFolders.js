import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'

// Las carpetas con fotos que se encuentran en este equipo. La búsqueda empieza sola al abrir la app.
export function usePcFolders() {
  const [folders, setFolders] = useState([])
  const [scanning, setScanning] = useState(Boolean(api))

  const start = useCallback((roots) => {
    setScanning(true)
    api.startScan(roots, 'pc')
  }, [])

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
    api.startScan(undefined, 'pc')
    return () => {
      offBatch()
      offDone()
      api.stopScan('pc')
    }
  }, [])

  const rescan = () => {
    setFolders([])
    start()
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

  return { folders, scanning, rescan, stop, addFolder, removeCounts }
}
