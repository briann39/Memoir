import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cleanError } from './errors'
import RightPanel from './components/RightPanel'
import SendDialog from './components/SendDialog'
import Sidebar from './components/Sidebar'
import Viewer from './components/Viewer'
import {
  addAlbum,
  addTag,
  addToAlbum,
  EMPTY_LIBRARY,
  forgetImage,
  targetKey,
  hideFolder,
  imageFromPath,
  loadLibrary,
  removeAlbum,
  removeTag,
  restoreFolder,
  saveLibrary,
  toggleImageTag,
  toggleInAlbum,
} from './library'

const api = window.electronAPI
const LOOSE = '__loose__'

function App() {
  const [folders, setFolders] = useState([])
  const [scanning, setScanning] = useState(Boolean(api)) // la app de escritorio escanea al iniciar
  const [expanded, setExpanded] = useState(() => new Set())
  const [filesByKey, setFilesByKey] = useState({}) // carpeta -> imágenes (se cargan al abrirla)
  const [loose, setLoose] = useState([])
  const [selected, setSelected] = useState(null) // { key, index }
  const [dragging, setDragging] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendJob, setSendJob] = useState(null) // fotos que esperan que se elija la carpeta del servidor
  const [progress, setProgress] = useState(null) // { done, total } mientras se envía
  const [marked, setMarked] = useState(() => new Set()) // fotos marcadas para enviar
  const [notice, setNotice] = useState(null)
  const [library, setLibrary] = useState(EMPTY_LIBRARY)
  const libraryLoaded = useRef(false)
  const inputRef = useRef(null)

  const startScan = useCallback((roots) => {
    setScanning(true)
    api.startScan(roots)
  }, [])

  // Escaneo inicial del equipo (solo en la app de escritorio)
  useEffect(() => {
    if (!api) return
    const offBatch = api.onScanBatch((lote) =>
      setFolders((prev) => {
        const known = new Set(prev.map((f) => f.path))
        return [...prev, ...lote.filter((f) => !known.has(f.path))]
      }),
    )
    const offDone = api.onScanDone(() => setScanning(false))
    api.startScan()
    return () => {
      offBatch()
      offDone()
      api.stopScan()
    }
  }, [])

  // Álbumes y etiquetas: se cargan al iniciar y se guardan en cada cambio
  useEffect(() => {
    loadLibrary().then((lib) => {
      libraryLoaded.current = true
      setLibrary(lib)
    })
  }, [])

  useEffect(() => {
    if (libraryLoaded.current) saveLibrary(library)
  }, [library])

  // Colecciones virtuales: el contenido de cada álbum y de cada etiqueta
  const virtualFiles = useMemo(() => {
    const map = {}
    for (const album of library.albums) map[`album:${album.id}`] = album.images.map(imageFromPath)
    for (const tag of library.tags) map[`tag:${tag.id}`] = []
    for (const [file, ids] of Object.entries(library.imageTags)) {
      for (const id of ids) map[`tag:${id}`]?.push(imageFromPath(file))
    }
    for (const tag of library.tags) {
      map[`tag:${tag.id}`].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    }
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
        icon: '🏷️',
      })),
    [library.tags, virtualFiles],
  )

  const allFiles = useMemo(
    () => ({ ...filesByKey, [LOOSE]: loose, ...virtualFiles }),
    [filesByKey, loose, virtualFiles],
  )

  // Las carpetas descartadas no se muestran, aunque el escaneo las vuelva a encontrar
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
    setMarked(new Set())
    startScan()
  }

  const stop = () => {
    api.stopScan()
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

  // Manda la foto a la Papelera. Si la carpeta está sincronizada con la nube, allí también se elimina.
  const deleteImage = async () => {
    if (!current || selected.key === LOOSE) return
    const file = current.id
    const aviso = `¿Eliminar "${current.name}"?

Se enviará a la Papelera de reciclaje. Si está en una carpeta de iCloud, también se eliminará de iCloud.`
    if (!window.confirm(aviso)) return
    try {
      await api.trashFile(file)
    } catch {
      window.alert('No se pudo eliminar la foto.')
      return
    }
    removeFromViews([file])
  }

  const toggleMark = (file) =>
    setMarked((prev) => {
      const next = new Set(prev)
      if (next.has(file)) next.delete(file)
      else next.add(file)
      return next
    })

  const markAll = (files, on) =>
    setMarked((prev) => {
      const next = new Set(prev)
      for (const img of files) {
        if (on) next.add(img.id)
        else next.delete(img.id)
      }
      return next
    })

  // Abre el selector de carpeta del servidor (persona o mascota) para esas fotos
  const startSend = (files) => {
    if (!files.length || sending) return
    if (!library.serverFolder) {
      window.alert('Primero elige la carpeta del servidor en el panel derecho.')
      return
    }
    setSendJob(files)
  }

  const sendCurrent = () => {
    if (current && selected.key !== LOOSE) startSend([current.id])
  }

  // Envía una por una las fotos a la carpeta elegida y las mueve: salen de las listas igual que al eliminar
  const sendToServer = async (kind, name) => {
    const files = sendJob
    setSendJob(null)
    setSending(true)
    setProgress({ done: 0, total: files.length })
    const sent = []
    let failure = null
    for (const file of files) {
      try {
        await api.sendToServer(file, library.serverFolder, kind, name, true)
        sent.push(file)
        setProgress({ done: sent.length, total: files.length })
      } catch (err) {
        failure = cleanError(err)
        break
      }
    }
    if (sent.length) {
      setLibrary((l) => ({ ...l, lastSubfolder: targetKey(kind, name) }))
      removeFromViews(sent)
    }
    setSending(false)
    setProgress(null)

    const destino = name || 'la raíz del servidor'
    if (failure) {
      window.alert(
        sent.length ? `Se enviaron ${sent.length} de ${files.length} fotos a ${destino}.\n\n${failure}` : failure,
      )
    } else if (sent.length === 1) {
      setNotice(`"${sent[0].split(/[\\/]/).pop()}" enviada a ${destino}`)
    } else {
      setNotice(`${sent.length} fotos enviadas a ${destino}`)
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
    setMarked((prev) => new Set([...prev].filter((file) => !gone.has(file))))
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
        scanning={scanning}
        canScan={Boolean(api)}
        expanded={expanded}
        filesByKey={allFiles}
        selected={selected}
        onToggle={toggleFolder}
        onHide={discardFolder}
        onDropImage={dropInAlbum}
        onRestore={(folder) => setLibrary((l) => restoreFolder(l, folder))}
        marked={marked}
        markedCount={marked.size}
        sending={sending}
        progress={progress}
        onToggleMark={toggleMark}
        onMarkAll={markAll}
        onSendMarked={() => startSend([...marked])}
        onClearMarks={() => setMarked(new Set())}
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
            onDelete={deleteImage}
            marked={marked.has(current.id)}
            onToggleMark={() => toggleMark(current.id)}
            onSend={api ? sendCurrent : undefined}
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
        onServerFolder={(folder) => setLibrary((l) => ({ ...l, serverFolder: folder.trim() }))}
        onPickServerFolder={async () => {
          const [folder] = await api.selectFolders()
          if (folder) setLibrary((l) => ({ ...l, serverFolder: folder }))
        }}
        onToggleTag={(tagId) => setLibrary((l) => toggleImageTag(l, current.id, tagId))}
        onAddTag={(name) => setLibrary((l) => addTag(l, name))}
        onRemoveTag={(tagId) => setLibrary((l) => removeTag(l, tagId))}
        onToggleAlbum={(albumId) => setLibrary((l) => toggleInAlbum(l, albumId, current.id))}
        onDropImage={dropInAlbum}
        onAddAlbum={(name) => setLibrary((l) => addAlbum(l, name))}
        onRemoveAlbum={(albumId) => setLibrary((l) => removeAlbum(l, albumId))}
      />

      {sendJob && (
        <SendDialog
          serverFolder={library.serverFolder}
          lastUsed={library.lastSubfolder}
          count={sendJob.length}
          onPick={sendToServer}
          onClose={() => setSendJob(null)}
        />
      )}
    </div>
  )
}

export default App
