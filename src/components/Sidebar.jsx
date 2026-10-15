import { useState } from 'react'

function Sidebar({
  folders,
  scanning,
  activePath,
  canScan,
  onSelect,
  onStop,
  onRescan,
  onAddFolder,
  onOpenFiles,
}) {
  const [query, setQuery] = useState('')

  const term = query.trim().toLowerCase()
  const visible = folders
    .filter((f) => f.name.toLowerCase().includes(term) || f.path.toLowerCase().includes(term))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  const total = folders.reduce((sum, f) => sum + f.count, 0)

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-slate-800 bg-slate-950">
      <div className="space-y-3 p-4">
        <h1 className="text-xl font-bold text-sky-400">Visor de imágenes</h1>
        <div className="flex gap-2">
          {canScan && (
            <button
              type="button"
              onClick={onAddFolder}
              className="flex-1 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-400"
            >
              Agregar carpeta
            </button>
          )}
          <button
            type="button"
            onClick={onOpenFiles}
            className="flex-1 rounded-lg bg-sky-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-400"
          >
            Abrir imágenes
          </button>
        </div>
        {canScan && (
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar carpeta..."
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-sky-400"
          />
        )}
      </div>

      {canScan && (
        <>
          <div className="flex items-center justify-between gap-2 px-4 pb-2 text-xs text-slate-400">
            <span className="truncate">
              {scanning ? 'Buscando…' : `${folders.length} carpetas · ${total} fotos`}
            </span>
            <button
              type="button"
              onClick={scanning ? onStop : onRescan}
              className="shrink-0 rounded px-2 py-1 transition hover:bg-slate-800 hover:text-slate-100"
            >
              {scanning ? 'Detener' : 'Volver a buscar'}
            </button>
          </div>

          <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
            {visible.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-slate-500">
                {scanning ? 'Buscando fotos…' : 'No se encontraron carpetas'}
              </p>
            )}
            {visible.map((f) => (
              <button
                key={f.path}
                type="button"
                title={f.path}
                onClick={() => onSelect(f)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-slate-800 ${
                  activePath === f.path ? 'bg-slate-800 text-sky-400' : ''
                }`}
              >
                <span aria-hidden>📁</span>
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <span className="shrink-0 text-xs text-slate-500">{f.count}</span>
              </button>
            ))}
          </nav>
        </>
      )}
    </aside>
  )
}

export default Sidebar
