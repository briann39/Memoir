import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cleanError } from './errors'
import RightPanel from './components/RightPanel'
import Sidebar from './components/Sidebar'
import Viewer from './components/Viewer'
import {
  addAlbum,
  addTag,
  addToAlbum,
  buildCatalog,
  clearDeleteMarks,
  EMPTY_LIBRARY,
  forgetImage,
  hideFolder,
  imageFromPath,
  importLegacyFolder,
  isServerPath,
  kindOf,
  loadLibrary,
  mergeCatalog,
  moveMeta,
  removeAlbum,
  removeTag,
  restoreFolder,
  saveLibrary,
  sendPlan,
  toggleDelete,
  toggleImageTag,
  toggleInAlbum,
  validFolderName,
} from './library'

const api = window.electronAPI
const LOOSE = '__loose__'
const FILTER = '__filter__'

const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })

function App() {
  const [folders, setFolders] = useState([])
  const [scanning, setScanning] = useState(Boolean(api)) // la app de escritorio escanea al iniciar
  const [expanded, setExpanded] = useState(() => new Set())
  const [filesByKey, setFilesByKey] = useState({}) // carpeta -> imágenes (se cargan al abrirla)
  const [loose, setLoose] = useState([])
  const [selected, setSelected] = useState(null) // { key, index }
  const [dragging, setDragging] = useState(false)
  const [sending, setSending] = useState(false)
  const [progress, setProgress] = useState(null) // { done, total } mientras se envía
  const [notice, setNotice] = useState(null)
  const [library, setLibrary] = useState(EMPTY_LIBRARY)
  const [libraryReady, setLibraryReady] = useState(false)
  const [serverFolders, setServerFolders] = useState([]) // álbumes (carpetas) del servidor
  const [serverStatus, setServerStatus] = useState({ root: '', state: 'loading' })
  const [serverTick, setServerTick] = useState(0) // sube para reintentar la conexión
  const [filterIds, setFilterIds] = useState([]) // personas o mascotas elegidas para filtrar
  const [filterMode, setFilterMode] = useState('all') // 'all': salen todas · 'any': sale alguna
  const catalogRoot = useRef(null) // servidor cuyo catálogo se cargó bien; solo entonces se guarda
  const inputRef = useRef(null)
  const serverRoot = library.serverFolder

  const startScan = useCallback((roots) => {
    setScanning(true)
    api.startScan(roots, 'pc')
  }, [])

  // Búsqueda inicial del equipo (solo en la app de escritorio) y avisos de las búsquedas
  useEffect(() => {
    if (!api) return
    const offBatch = api.onScanBatch((channel, lote) => {
      if (channel === 'pc') {
        setFolders((prev) => {
          const known = new Set(prev.map((f) => f.path))
          return [...prev, ...lote.filter((f) => !known.has(f.path))]
        })
        return
      }
      // Servidor: los álbumes de la versión anterior (Personas\Ana) dan sus datos a las fotos, una sola vez
      setLibrary((l) => lote.filter((f) => f.legacy).reduce((lib, f) => importLegacyFolder(lib, f), l))
      setServerFolders((prev) => {
        const known = new Set(prev.map((f) => f.path))
        const nuevos = lote.filter((f) => !known.has(f.path)).map((f) => ({ ...f, files: undefined }))
        return [...prev, ...nuevos]
      })
    })
    const offDone = api.onScanDone((channel) => {
      if (channel === 'pc') setScanning(false)
      else setServerStatus((s) => (s.state === 'scanning' ? { ...s, state: 'ready' } : s))
    })
    api.startScan(undefined, 'pc')
    return () => {
      offBatch()
      offDone()
      api.stopScan('pc')
    }
  }, [])

  // Álbumes, etiquetas, personas y mascotas: se cargan al iniciar y se guardan en cada cambio
  useEffect(() => {
    loadLibrary().then((lib) => {
      setLibrary(lib)
      setLibraryReady(true)
    })
  }, [])

  useEffect(() => {
    if (libraryReady) saveLibrary(library)
  }, [library, libraryReady])

  // Servidor: se leen primero sus datos (catálogo) y después sus álbumes. Si no hay conexión no se toca nada.
  useEffect(() => {
    if (!api || !libraryReady || !serverRoot) return
    let stale = false
    api
      .loadCatalog(serverRoot)
      .then((catalog) => {
        if (stale) return
        catalogRoot.current = serverRoot
        setLibrary((l) => mergeCatalog(l, catalog))
        setServerFolders([])
        setServerStatus({ root: serverRoot, state: 'scanning' })
        api.startScan([serverRoot], 'server')
      })
      .catch((err) => {
        if (stale) return
        catalogRoot.current = null
        setServerStatus({ root: serverRoot, state: 'offline', error: cleanError(err) })
      })
    return () => {
      stale = true
      catalogRoot.current = null
      api.stopScan('server')
    }
  }, [libraryReady, serverRoot, serverTick])

  // Los datos de las fotos del servidor se guardan también en el servidor
  useEffect(() => {
    if (!api || !serverRoot || catalogRoot.current !== serverRoot) return
    const timer = setTimeout(() => {
      api
        .saveCatalog(serverRoot, buildCatalog(library))
        .catch(() => setNotice('No se pudieron guardar los datos en el servidor'))
    }, 500)
    return () => clearTimeout(timer)
  }, [library, serverRoot])

  const serverState = !serverRoot ? 'none' : serverStatus.root === serverRoot ? serverStatus.state : 'loading'

  const retryServer = () => {
    setServerStatus({ root: serverRoot, state: 'loading' })
    setServerTick((t) => t + 1)
  }

  // Colecciones virtuales: el contenido de cada álbum de la app y de cada etiqueta
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
        virtual: true,
        icon: '📒',
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
        virtual: true,
        icon: { persona: '👤', mascota: '🐾', tag: '🏷️' }[kindOf(t)],
      })),
    [library.tags, virtualFiles],
  )

  // Filtro por personas y mascotas: fotos donde salen todas las elegidas, o alguna de ellas
  const people = useMemo(() => library.tags.filter((t) => kindOf(t) !== 'tag'), [library.tags])
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
    ? { path: FILTER, name: 'Resultado', count: filterResults.length, virtual: true, icon: '🔎' }
    : null

  const toggleFilter = (tagId) => {
    setFilterIds((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]))
    setExpanded((prev) => new Set(prev).add(FILTER))
  }

  const allFiles = useMemo(
    () => ({ ...filesByKey, [LOOSE]: loose, [FILTER]: filterResults, ...virtualFiles }),
    [filesByKey, loose, filterResults, virtualFiles],
  )

  // Las carpetas descartadas no se muestran, aunque la búsqueda las vuelva a encontrar
  const shownFolders = useMemo(
    () => folders.filter((f) => !library.hiddenFolders.includes(f.path)),
    [folders, library.hiddenFolders],
  )

  const discardFolder = (entry) => {
    setLibrary((l) => hideFolder(l, entry.path))
    setSelected((s) => (s?.key === entry.path ? null : s))
  }

  const rescan = () => {
    setFolders([])
    setExpanded(new Set())
    setFilesByKey({})
    setSelected(null)
    startScan()
  }

  const stop = () => {
    api.stopScan('pc')
    setScanning(false)
  }

  const addFolder = async () => {
    const roots = await api.selectFolders()
    if (roots.length) startScan(roots)
  }

  // Abre o cierra una carpeta en el explorador; sus imágenes se leen la primera vez
  const toggleFolder = async (entry) => {
    const abierta = expanded.has(entry.path)
    setExpanded((prev) => {
      const next = new Set(prev)
      if (abierta) next.delete(entry.path)
      else next.add(entry.path)
      return next
    })
    if (abierta || entry.virtual || filesByKey[entry.path]) return
    const images = await api.readFolder(entry.path)
    setFilesByKey((prev) => ({ ...prev, [entry.path]: images }))
  }

  const images = selected ? allFiles[selected.key] : null
  const current = images?.[selected.index]

  const step = useCallback(
    (delta) =>
      setSelected((s) => {
        const total = s ? allFiles[s.key]?.length : 0
        if (!total) return s
        return { ...s, index: (s.index + delta + total) % total }
      }),
    [allFiles],
  )
  const prev = useCallback(() => step(-1), [step])
  const next = useCallback(() => step(1), [step])

  const addFiles = (fileList) => {
    const nuevas = Array.from(fileList)
      .filter((file) => file.type.startsWith('image/'))
      .map((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        url: URL.createObjectURL(file),
      }))
    if (!nuevas.length) return
    setSelected({ key: LOOSE, index: loose.length })
    setLoose((prev) => [...prev, ...nuevas])
    setExpanded((prev) => new Set(prev).add(LOOSE))
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(timer)
  }, [notice])

  const dropInAlbum = (albumId, file) => setLibrary((l) => addToAlbum(l, albumId, file))

  const onAddAlbum = (name) => {
    if (!validFolderName(name)) {
      window.alert('Los álbumes son carpetas del servidor: no uses / \\ : * ? " < > | ni empieces o termines con un punto.')
      return
    }
    setLibrary((l) => addAlbum(l, name))
  }

  // Eliminar es en dos pasos: primero se marcan las fotos (no se borra nada) y después se borran juntas
  const toDelete = useMemo(() => new Set(library.toDelete), [library.toDelete])

  const toggleDeleteMark = () => {
    if (current && selected.key !== LOOSE && !isServerPath(library, current.id)) {
      setLibrary((l) => toggleDelete(l, current.id))
    }
  }

  // Manda las fotos marcadas a la Papelera. Si están en una carpeta de iCloud, también se eliminan de allí.
  const deleteMarked = async () => {
    if (sending || !library.toDelete.length) return
    const files = [...library.toDelete]
    const aviso = `¿Eliminar ${files.length === 1 ? 'la foto marcada' : `las ${files.length} fotos marcadas`}?\n\nIrán a la Papelera de reciclaje. Si están en una carpeta de iCloud, también se eliminarán de iCloud.`
    if (!window.confirm(aviso)) return

    setSending(true)
    setProgress({ label: 'Eliminando', done: 0, total: files.length })
    const done = []
    let failure = null
    for (const file of files) {
      try {
        if ((await api.fileInfo(file)).exists) await api.trashFile(file)
        done.push(file) // si ya no existía, solo se quita de las listas
      } catch (err) {
        failure = cleanError(err)
        break
      }
      setProgress({ label: 'Eliminando', done: done.length, total: files.length })
    }
    if (done.length) removeFromViews(done)
    setSending(false)
    setProgress(null)

    if (failure) {
      window.alert(
        `Se eliminaron ${done.length} de ${files.length} fotos.\n\n${failure}\n\nLas demás siguen marcadas: puedes volver a intentarlo.`,
      )
    } else {
      setNotice(`${done.length} ${done.length === 1 ? 'foto eliminada' : 'fotos eliminadas'}`)
    }
  }

  // Fotos de este equipo que están en un álbum de la app o tienen persona o mascota: se envían juntas,
  // cada una a la carpeta del servidor con el nombre de su álbum
  const plan = useMemo(() => sendPlan(library), [library])

  const sendAll = async () => {
    if (sending || !plan.length) return
    if (!serverRoot) {
      window.alert('Primero elige la carpeta del servidor en el panel derecho.')
      return
    }
    if (catalogRoot.current !== serverRoot) {
      window.alert('No hay conexión con el servidor. Comprueba que esté encendido y vuelve a intentarlo.')
      return
    }
    const porAlbum = new Map()
    for (const { album } of plan) porAlbum.set(album, (porAlbum.get(album) ?? 0) + 1)
    const resumen = [...porAlbum].map(([album, n]) => `• ${album}: ${n}`).join('\n')
    const aviso = `Se enviarán ${plan.length} fotos al servidor, a estos álbumes:\n\n${resumen}\n\nSus datos (personas, mascotas y etiquetas) viajan con ellas. Las originales irán a la Papelera; si están en una carpeta de iCloud, también se eliminarán de iCloud.`
    if (!window.confirm(aviso)) return

    setSending(true)
    setProgress({ label: 'Enviando', done: 0, total: plan.length })
    const sent = []
    const missing = []
    let failure = null
    for (const { file, album } of plan) {
      try {
        sent.push({ from: file, to: await api.sendToServer(file, serverRoot, album, true) })
      } catch (err) {
        if (err.message.includes('SOURCE_MISSING')) missing.push(file) // ya no existe en el disco
        else {
          failure = cleanError(err)
          break
        }
      }
      setProgress({ label: 'Enviando', done: sent.length + missing.length, total: plan.length })
    }
    if (sent.length) {
      setLibrary((l) => moveMeta(l, sent)) // los datos pasan a la ruta nueva, en el servidor
      setFilesByKey((prev) => {
        const nuevas = new Set(sent.map(({ to }) => to.replace(/[\\/][^\\/]*$/, '')))
        return Object.fromEntries(Object.entries(prev).filter(([dir]) => !nuevas.has(dir)))
      })
      setServerFolders([])
      setServerStatus({ root: serverRoot, state: 'scanning' })
      api.startScan([serverRoot], 'server')
    }
    if (sent.length || missing.length) removeFromViews([...sent.map(({ from }) => from), ...missing])
    setSending(false)
    setProgress(null)

    const extra = missing.length ? ` (${missing.length} ya no existían)` : ''
    if (failure) {
      window.alert(
        `Se enviaron ${sent.length} de ${plan.length} fotos.${extra}\n\n${failure}\n\nLas que faltan siguen en su álbum de la app: puedes volver a pulsar Enviar.`,
      )
    } else {
      setNotice(`${sent.length} ${sent.length === 1 ? 'foto enviada' : 'fotos enviadas'} al servidor${extra}`)
    }
  }

  // Quita fotos que ya no están en el disco de todas las listas
  const removeFromViews = (files) => {
    const gone = new Set(files)
    setFilesByKey((prev) =>
      Object.fromEntries(Object.entries(prev).map(([key, list]) => [key, list.filter((i) => !gone.has(i.id))])),
    )
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
    setLibrary((l) => files.reduce((lib, file) => forgetImage(lib, file), l))
    setSelected((s) => {
      if (!s) return s
      const list = allFiles[s.key] ?? []
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

  const canEdit = Boolean(current) && selected.key !== LOOSE

  // Personas y mascotas indicadas en la foto que se está viendo
  const who = canEdit
    ? people
        .filter((t) => (library.imageTags[current.id] ?? []).includes(t.id))
        .map((t) => ({ id: t.id, name: t.name, kind: kindOf(t) }))
    : []

  return (
    <div
      className="flex h-screen bg-slate-900 text-slate-100"
      onDragOver={(e) => {
        e.preventDefault()
        if (e.dataTransfer.types.includes('Files')) setDragging(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false)
      }}
      onDrop={onDrop}
    >
      <Sidebar
        folders={shownFolders}
        hiddenFolders={library.hiddenFolders}
        looseCount={loose.length}
        albums={albumEntries}
        tags={tagEntries}
        people={people}
        filterIds={activeFilter}
        filterMode={filterMode}
        filterEntry={filterEntry}
        onToggleFilter={toggleFilter}
        onFilterMode={setFilterMode}
        serverFolders={serverFolders}
        serverState={serverState}
        serverError={serverStatus.error}
        onRetryServer={retryServer}
        scanning={scanning}
        canScan={Boolean(api)}
        expanded={expanded}
        filesByKey={allFiles}
        selected={selected}
        onToggle={toggleFolder}
        onHide={discardFolder}
        onDropImage={dropInAlbum}
        onRestore={(folder) => setLibrary((l) => restoreFolder(l, folder))}
        pendingCount={api ? plan.length : 0}
        toDelete={toDelete}
        sending={sending}
        progress={progress}
        onSendAll={sendAll}
        onDeleteMarked={deleteMarked}
        onClearDeleteMarks={() => setLibrary(clearDeleteMarks)}
        onPick={(key, index) => setSelected({ key, index })}
        onStop={stop}
        onRescan={rescan}
        onAddFolder={addFolder}
        onOpenFiles={() => inputRef.current?.click()}
      />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          addFiles(e.target.files)
          e.target.value = ''
        }}
      />

      <main className="relative min-w-0 flex-1">
        {current ? (
          <Viewer
            image={current}
            index={selected.index}
            total={images.length}
            persistent={canEdit}
            canMarkDelete={canEdit && !isServerPath(library, current.id)}
            markedDelete={toDelete.has(current.id)}
            onToggleDelete={toggleDeleteMark}
            who={who}
            sending={sending}
            onPrev={prev}
            onNext={next}
          />
        ) : (
          <div className="flex h-full p-6">
            <div
              className={`flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed transition ${
                dragging ? 'border-sky-400 bg-sky-400/10' : 'border-slate-700'
              }`}
            >
              <p className="text-lg font-medium">
                {api ? 'Abre una carpeta y elige una foto' : 'Arrastra imágenes aquí'}
              </p>
              <p className="text-sm text-slate-400">
                {api ? 'o arrastra imágenes a esta ventana' : 'o usa el botón "Abrir imágenes"'}
              </p>
            </div>
          </div>
        )}
        {notice && (
          <p className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white shadow-lg">
            {notice}
          </p>
        )}
      </main>

      <RightPanel
        image={current}
        canEdit={canEdit}
        library={library}
        onServerFolder={(folder) => setLibrary((l) => ({ ...l, serverFolder: folder.trim().replace(/\//g, '\\') }))}
        onPickServerFolder={async () => {
          const [folder] = await api.selectFolders()
          if (folder) setLibrary((l) => ({ ...l, serverFolder: folder.replace(/\//g, '\\') }))
        }}
        onToggleTag={(tagId) => setLibrary((l) => toggleImageTag(l, current.id, tagId))}
        onAddTag={(name, kind) => setLibrary((l) => addTag(l, name, kind))}
        onRemoveTag={(tagId) => setLibrary((l) => removeTag(l, tagId))}
        onToggleAlbum={(albumId) => setLibrary((l) => toggleInAlbum(l, albumId, current.id))}
        onDropImage={dropInAlbum}
        onAddAlbum={onAddAlbum}
        onRemoveAlbum={(albumId) => setLibrary((l) => removeAlbum(l, albumId))}
      />
    </div>
  )
}

export default App
