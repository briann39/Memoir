import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { cleanError } from '../errors'
import { buildCatalog, importLegacyFolder, mergeCatalog } from '../library'

// La carpeta del servidor: sus álbumes y el catálogo con los datos de sus fotos.
// Primero se lee el catálogo y después los álbumes. Si no hay conexión no se escribe nada en el servidor,
// para no pisar el catálogo real con uno vacío.
export function useServer({ library, setLibrary, libraryReady, setNotice }) {
  const root = library.serverFolder
  const [folders, setFolders] = useState([]) // álbumes (carpetas) del servidor
  const [status, setStatus] = useState({ root: '', state: 'loading' })
  const [tick, setTick] = useState(0) // sube para reintentar la conexión
  const catalogRoot = useRef(null) // servidor cuyo catálogo se leyó bien; solo entonces se guarda

  // Avisos de la búsqueda de álbumes
  useEffect(() => {
    if (!api) return
    const offBatch = api.onScanBatch((channel, lote) => {
      if (channel !== 'server') return
      // Los álbumes de la versión anterior (Personas\Ana) dan sus datos a las fotos, una sola vez
      setLibrary((l) => lote.filter((f) => f.legacy).reduce((lib, f) => importLegacyFolder(lib, f), l))
      setFolders((prev) => {
        const known = new Set(prev.map((f) => f.path))
        const nuevos = lote.filter((f) => !known.has(f.path)).map((f) => ({ ...f, files: undefined }))
        return [...prev, ...nuevos]
      })
    })
    const offDone = api.onScanDone((channel) => {
      if (channel === 'server') setStatus((s) => (s.state === 'scanning' ? { ...s, state: 'ready' } : s))
    })
    return () => {
      offBatch()
      offDone()
    }
  }, [setLibrary])

  // Lee el catálogo y, si se pudo, busca los álbumes
  useEffect(() => {
    if (!api || !libraryReady || !root) return
    let stale = false
    api
      .loadCatalog(root)
      .then((catalog) => {
        if (stale) return
        catalogRoot.current = root
        setLibrary((l) => mergeCatalog(l, catalog))
        setFolders([])
        setStatus({ root, state: 'scanning' })
        api.startScan([root], 'server')
      })
      .catch((err) => {
        if (stale) return
        catalogRoot.current = null
        setStatus({ root, state: 'offline', error: cleanError(err) })
      })
    return () => {
      stale = true
      catalogRoot.current = null
      api.stopScan('server')
    }
  }, [libraryReady, root, tick, setLibrary])

  // Los datos de las fotos del servidor se guardan también en el servidor
  useEffect(() => {
    if (!api || !root || catalogRoot.current !== root) return
    const timer = setTimeout(() => {
      api
        .saveCatalog(root, buildCatalog(library))
        .catch(() => setNotice('No se pudieron guardar los datos en el servidor.'))
    }, 500)
    return () => clearTimeout(timer)
  }, [library, root, setNotice])

  const state = !root ? 'none' : status.root === root ? status.state : 'loading'

  return {
    root,
    folders,
    state, // 'none' | 'loading' | 'scanning' | 'ready' | 'offline'
    error: status.error,
    connected: () => catalogRoot.current === root,
    retry: () => {
      setStatus({ root, state: 'loading' })
      setTick((t) => t + 1)
    },
    // Vuelve a leer los álbumes (después de enviar fotos)
    refresh: () => {
      setFolders([])
      setStatus({ root, state: 'scanning' })
      api.startScan([root], 'server')
    },
  }
}
