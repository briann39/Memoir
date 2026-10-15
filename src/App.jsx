import { useCallback, useEffect, useRef, useState } from 'react'
import Gallery from './components/Gallery'
import Sidebar from './components/Sidebar'

const api = window.electronAPI

function App() {
  const [folders, setFolders] = useState([])
  const [scanning, setScanning] = useState(Boolean(api)) // la app de escritorio escanea al iniciar
  const [gallery, setGallery] = useState(null) // { path, title, subtitle, images, loose }
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

  const releaseLoose = (g) => {
    if (g?.loose) g.images.forEach((i) => URL.revokeObjectURL(i.url))
  }

  const openFolder = async (folder) => {
    const images = await api.readFolder(folder.path)
    releaseLoose(gallery)
    setGallery({ path: folder.path, title: folder.name, subtitle: folder.path, images, loose: false })
  }

  const closeGallery = () => {
    releaseLoose(gallery)
    setGallery(null)
  }

  const addFiles = (fileList) => {
    const nuevas = Array.from(fileList)
      .filter((file) => file.type.startsWith('image/'))
      .map((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        url: URL.createObjectURL(file),
      }))
    if (!nuevas.length) return
    setGallery((prev) => ({
      path: null,
      title: 'Imágenes sueltas',
      subtitle: null,
      images: [...(prev?.loose ? prev.images : []), ...nuevas],
      loose: true,
    }))
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
        scanning={scanning}
        activePath={gallery?.path ?? null}
        canScan={Boolean(api)}
        onSelect={openFolder}
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

      <main className="min-w-0 flex-1 overflow-y-auto">
        {gallery ? (
          <Gallery
            key={gallery.path ?? 'sueltas'}
            title={gallery.title}
            subtitle={gallery.subtitle}
            images={gallery.images}
            onClose={gallery.loose ? closeGallery : undefined}
          />
        ) : (
          <div className="flex h-full p-6">
            <div
              className={`flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed transition ${
                dragging ? 'border-sky-400 bg-sky-400/10' : 'border-slate-700'
              }`}
            >
              <p className="text-lg font-medium">
                {api ? 'Selecciona una carpeta' : 'Arrastra imágenes aquí'}
              </p>
              <p className="text-sm text-slate-400">
                {api
                  ? 'o arrastra imágenes a esta ventana'
                  : 'o usa el botón "Abrir imágenes"'}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
