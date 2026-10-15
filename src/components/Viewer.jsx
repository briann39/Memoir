import { useEffect, useState } from 'react'
import { startImageDrag } from '../dnd'

// persistent: la foto es un archivo del disco (no una imagen suelta)
function Viewer({ image, index, total, persistent, onPrev, onNext, onDelete }) {
  const api = window.electronAPI
  const needsCheck = persistent && Boolean(api)
  const [info, setInfo] = useState(null) // { id, exists, cloud }
  const [preview, setPreview] = useState(null) // { id, url } vista previa de una foto en la nube
  const [revealed, setRevealed] = useState(null) // foto en la nube que el usuario decidió descargar

  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'ArrowLeft') onPrev()
      if (e.key === 'ArrowRight') onNext()
      if (e.key === 'Delete' && persistent) onDelete()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onPrev, onNext, onDelete, persistent])

  // Antes de cargar la imagen se mira si está solo en la nube: abrirla la descargaría
  useEffect(() => {
    if (!needsCheck) return
    let stale = false
    api.fileInfo(image.id).then((i) => {
      if (!stale) setInfo({ id: image.id, ...i })
    })
    return () => {
      stale = true
    }
  }, [api, image.id, needsCheck])

  const checked = !needsCheck || info?.id === image.id
  const missing = needsCheck && checked && !info.exists
  const cloudOnly = needsCheck && checked && info.exists && info.cloud && revealed !== image.id

  // Vista previa de las fotos en la nube, sin descargarlas
  useEffect(() => {
    if (!cloudOnly) return
    let stale = false
    api.thumbnail(image.id, 1024).then((url) => {
      if (!stale) setPreview({ id: image.id, url })
    })
    return () => {
      stale = true
    }
  }, [api, image.id, cloudOnly])

  const previewUrl = preview?.id === image.id ? preview.url : null

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-6 py-3">
        <p className="min-w-0 truncate text-sm font-medium">{image.name}</p>
        <div className="flex shrink-0 items-center gap-4">
          <p className="text-sm text-slate-400">
            {index + 1} / {total}
          </p>
          {persistent && (
            <button
              type="button"
              title="Eliminar (Supr)"
              onClick={onDelete}
              className="rounded-lg bg-red-500/15 px-3 py-1 text-sm text-red-300 transition hover:bg-red-500 hover:text-white"
            >
              🗑 Eliminar
            </button>
          )}
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center p-6">
        {!checked ? null : missing ? (
          <p className="text-slate-400">Este archivo ya no existe en el disco.</p>
        ) : cloudOnly ? (
          <div className="flex h-full w-full flex-col items-center gap-4">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={image.name}
                className="min-h-0 max-w-full flex-1 rounded-lg object-contain"
              />
            ) : (
              <span className="m-auto text-6xl" aria-hidden>
                ☁️
              </span>
            )}
            <div className="flex shrink-0 flex-wrap items-center justify-center gap-3 text-sm">
              <span className="text-slate-400">
                ☁️ {previewUrl ? 'Vista previa' : 'Solo en la nube'} · la foto completa no está en tu PC
              </span>
              <button
                type="button"
                onClick={() => setRevealed(image.id)}
                className="rounded-lg bg-sky-500 px-3 py-1.5 font-medium text-white transition hover:bg-sky-400"
              >
                Descargar y ver completa
              </button>
            </div>
          </div>
        ) : (
          <img
            key={image.id}
            src={image.url}
            alt={image.name}
            draggable={persistent}
            onDragStart={(e) => startImageDrag(e, image.id)}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        )}
        {total > 1 && (
          <>
            <button
              type="button"
              aria-label="Anterior"
              onClick={onPrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-4 py-2 text-2xl transition hover:bg-white/20"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Siguiente"
              onClick={onNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-4 py-2 text-2xl transition hover:bg-white/20"
            >
              ›
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default Viewer
