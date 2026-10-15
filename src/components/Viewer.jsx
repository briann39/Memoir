import { useEffect } from 'react'

function Viewer({ image, index, total, onPrev, onNext }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'ArrowLeft') onPrev()
      if (e.key === 'ArrowRight') onNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onPrev, onNext])

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-6 py-3">
        <p className="min-w-0 truncate text-sm font-medium">{image.name}</p>
        <p className="shrink-0 text-sm text-slate-400">
          {index + 1} / {total}
        </p>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center p-6">
        <img
          key={image.id}
          src={image.url}
          alt={image.name}
          className="max-h-full max-w-full rounded-lg object-contain"
        />
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
