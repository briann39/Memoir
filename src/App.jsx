import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import RightPanel from './components/RightPanel'
import Sidebar from './components/Sidebar'
import Viewer from './components/Viewer'
import {
  addAlbum,
  addTag,
  EMPTY_LIBRARY,
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

  const canEdit = Boolean(current) && selected.key !== LOOSE

  return (
    <div
      className="flex h-screen bg-slate-900 text-slate-100"
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
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
        onRestore={(folder) => setLibrary((l) => restoreFolder(l, folder))}
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

      <main className="min-w-0 flex-1">
        {current ? (
          <Viewer
            image={current}
            index={selected.index}
            total={images.length}
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
      </main>

      <RightPanel
        image={current}
        canEdit={canEdit}
        library={library}
        onToggleTag={(tagId) => setLibrary((l) => toggleImageTag(l, current.id, tagId))}
        onAddTag={(name) => setLibrary((l) => addTag(l, name))}
        onRemoveTag={(tagId) => setLibrary((l) => removeTag(l, tagId))}
        onToggleAlbum={(albumId) => setLibrary((l) => toggleInAlbum(l, albumId, current.id))}
        onAddAlbum={(name) => setLibrary((l) => addAlbum(l, name))}
        onRemoveAlbum={(albumId) => setLibrary((l) => removeAlbum(l, albumId))}
      />
    </div>
  )
}

export default App
