import { useCallback, useEffect, useRef, useState } from 'react'
import Sidebar from './components/Sidebar'
import Viewer from './components/Viewer'

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
  const toggleFolder = async (folder) => {
    const abierta = expanded.has(folder.path)
    setExpanded((prev) => {
      const next = new Set(prev)
      if (abierta) next.delete(folder.path)
      else next.add(folder.path)
      return next
    })
    if (abierta || folder.path === LOOSE || filesByKey[folder.path]) return
    const images = await api.readFolder(folder.path)
    setFilesByKey((prev) => ({ ...prev, [folder.path]: images }))
  }

  const filesOf = (key) => (key === LOOSE ? loose : filesByKey[key])
  const images = selected ? filesOf(selected.key) : null
  const current = images?.[selected.index]

  const step = useCallback(
    (delta) =>
      setSelected((s) => {
        if (!s) return s
        const total = (s.key === LOOSE ? loose : filesByKey[s.key]).length
        return { ...s, index: (s.index + delta + total) % total }
      }),
    [loose, filesByKey],
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
        folders={folders}
        looseCount={loose.length}
        scanning={scanning}
        canScan={Boolean(api)}
        expanded={expanded}
        filesByKey={{ ...filesByKey, [LOOSE]: loose }}
        selected={selected}
        onToggle={toggleFolder}
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
    </div>
  )
}

export default App
