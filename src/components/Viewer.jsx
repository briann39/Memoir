import { useEffect, useState } from 'react'
import { startImageDrag } from '../dnd'

// persistent: la foto es un archivo del disco (no una imagen suelta)
function Viewer({ image, index, total, persistent, onPrev, onNext, onDelete }) {
  const api = window.electronAPI
  const needsCheck = persistent && Boolean(api)
  const [info, setInfo] = useState(null) // { id, exists, cloud }
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
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="text-6xl" aria-hidden>
              ☁️
            </span>
            <p className="font-medium">Esta foto está solo en la nube</p>
            <p className="max-w-xs text-sm text-slate-400">
              Verla la descargará a tu PC y ocupará espacio. Puedes eliminarla sin descargarla.
            </p>
            <button
              type="button"
              onClick={() => setRevealed(image.id)}
              className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-400"
            >
              Descargar y ver
            </button>
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
