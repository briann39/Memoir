import { useCallback, useEffect, useState } from 'react'

function Gallery({ title, subtitle, images, onClose }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)

  const term = query.trim().toLowerCase()
  const visible = images.filter((i) => i.name.toLowerCase().includes(term))
  const current = selected !== null ? visible[selected] : null

  const prev = useCallback(
    () => setSelected((i) => (i === null ? i : (i - 1 + visible.length) % visible.length)),
    [visible.length],
  )
  const next = useCallback(
    () => setSelected((i) => (i === null ? i : (i + 1) % visible.length)),
    [visible.length],
  )

  useEffect(() => {
    if (selected === null) return
    const onKey = (e) => {
      if (e.key === 'Escape') setSelected(null)
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, prev, next])

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold">{title}</h2>
          {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
        </div>
        <span className="ml-auto shrink-0 text-sm text-slate-400">{visible.length} imágenes</span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-slate-700 px-3 py-1.5 text-sm transition hover:bg-slate-800"
          >
            Cerrar
          </button>
        )}
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setSelected(null)
        }}
        placeholder="Buscar por nombre..."
        className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm outline-none focus:border-sky-400"
      />

      {visible.length === 0 ? (
        <p className="py-16 text-center text-slate-400">Sin resultados</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {visible.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setSelected(i)}
              className="group aspect-square overflow-hidden rounded-xl bg-slate-800 focus:outline-2 focus:outline-sky-400"
            >
              <img
                src={img.url}
                alt={img.name}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
              />
            </button>
          ))}
        </div>
      )}

      {current && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setSelected(null)}
        >
          <img
            src={current.url}
            alt={current.name}
            className="max-h-[85vh] max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <p className="absolute bottom-4 left-1/2 max-w-[80%] -translate-x-1/2 truncate text-sm text-slate-300">
            {current.name} · {selected + 1} / {visible.length}
          </p>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setSelected(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 px-3 py-1 text-xl transition hover:bg-white/20"
          >
            ✕
          </button>
          {visible.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Anterior"
                onClick={(e) => {
                  e.stopPropagation()
                  prev()
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-4 py-2 text-2xl transition hover:bg-white/20"
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Siguiente"
                onClick={(e) => {
                  e.stopPropagation()
                  next()
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-4 py-2 text-2xl transition hover:bg-white/20"
              >
                ›
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default Gallery
