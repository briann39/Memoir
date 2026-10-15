import { useState } from 'react'
import { dropTarget, startImageDrag } from '../dnd'

function SectionTitle({ children }) {
  return (
    <h2 className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </h2>
  )
}

function Sidebar({
  folders,
  hiddenFolders,
  looseCount,
  albums,
  tags,
  scanning,
  canScan,
  expanded,
  filesByKey,
  selected,
  onToggle,
  onHide,
  onRestore,
  onDropImage,
  onPick,
  onStop,
  onRescan,
  onAddFolder,
  onOpenFiles,
}) {
  const [query, setQuery] = useState('')
  const [showHidden, setShowHidden] = useState(false)
  const [dropKey, setDropKey] = useState(null) // álbum sobre el que está el cursor al arrastrar

  const term = query.trim().toLowerCase()
  const visible = folders
    .filter((f) => f.name.toLowerCase().includes(term) || f.path.toLowerCase().includes(term))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  const total = folders.reduce((sum, f) => sum + f.count, 0)

  // Entrada desplegable: carpeta real o colección virtual (álbum, etiqueta, imágenes sueltas)
  const renderEntry = (f) => {
    const isOpen = expanded.has(f.path)
    const files = filesByKey[f.path]
    return (
      <div key={f.path}>
        <div
          className={`group flex items-center rounded-lg transition hover:bg-slate-800 ${
            dropKey === f.path ? 'bg-sky-500/20 ring-1 ring-sky-400' : ''
          }`}
          {...(f.albumId &&
            dropTarget(
              (over) => setDropKey(over ? f.path : null),
              (file) => onDropImage(f.albumId, file),
            ))}
        >
          <button
            type="button"
            title={f.virtual ? f.name : f.path}
            aria-expanded={isOpen}
            onClick={() => onToggle(f)}
            className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm"
          >
            <span aria-hidden className="w-3 text-xs text-slate-500">
              {isOpen ? '▾' : '▸'}
            </span>
            <span aria-hidden>{f.icon ?? (isOpen ? '📂' : '📁')}</span>
            <span className="min-w-0 flex-1 truncate">{f.name}</span>
            <span className="shrink-0 text-xs text-slate-500">{f.count}</span>
          </button>
          {!f.virtual && (
            <button
              type="button"
              title="Descartar del visor"
              aria-label={`Descartar ${f.name}`}
              onClick={() => onHide(f)}
              className="px-2 text-xs text-slate-500 opacity-0 transition hover:text-red-400 focus:opacity-100 group-hover:opacity-100"
            >
              ✕
            </button>
          )}
        </div>

        {isOpen && (
          <ul className="mb-1 ml-5 border-l border-slate-800 pl-2">
            {!files && <li className="px-3 py-1 text-xs text-slate-500">Cargando…</li>}
            {files?.length === 0 && <li className="px-3 py-1 text-xs text-slate-500">Vacío</li>}
            {files?.map((img, i) => {
              const active = selected?.key === f.path && selected.index === i
              return (
                <li key={img.id}>
                  <button
                    type="button"
                    title={img.name}
                    draggable={f.path !== '__loose__'}
                    onDragStart={(e) => startImageDrag(e, img.id)}
                    onClick={() => onPick(f.path, i)}
                    className={`block w-full truncate rounded px-3 py-1 text-left text-xs transition hover:bg-slate-800 ${
                      active ? 'bg-slate-800 text-sky-400' : 'text-slate-300'
                    }`}
                  >
                    {img.name}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    )
  }

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

      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {looseCount > 0 &&
          renderEntry({
            path: '__loose__',
            name: 'Imágenes sueltas',
            count: looseCount,
            virtual: true,
            icon: '🖼️',
          })}

        {albums.length > 0 && (
          <>
            <SectionTitle>Álbumes</SectionTitle>
            {albums.map(renderEntry)}
          </>
        )}

        {tags.length > 0 && (
          <>
            <SectionTitle>Etiquetas</SectionTitle>
            {tags.map(renderEntry)}
          </>
        )}

        {canScan && (
          <>
            <div className="flex items-center justify-between gap-2 pr-1">
              <SectionTitle>Carpetas</SectionTitle>
              <button
                type="button"
                onClick={scanning ? onStop : onRescan}
                className="mt-2 shrink-0 rounded px-2 py-0.5 text-xs text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
              >
                {scanning ? 'Detener' : 'Volver a buscar'}
              </button>
            </div>
            <p className="px-3 pb-1 text-xs text-slate-500">
              {scanning ? 'Buscando…' : `${folders.length} carpetas · ${total} fotos`}
            </p>
            {visible.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-slate-500">
                {scanning ? 'Buscando fotos…' : 'No se encontraron carpetas'}
              </p>
            )}
            {visible.map(renderEntry)}

            {hiddenFolders.length > 0 && (
              <div className="mt-3 border-t border-slate-800 pt-2">
                <button
                  type="button"
                  aria-expanded={showHidden}
                  onClick={() => setShowHidden((v) => !v)}
                  className="w-full rounded px-3 py-1 text-left text-xs text-slate-400 transition hover:bg-slate-800"
                >
                  {showHidden ? '▾' : '▸'} Descartadas ({hiddenFolders.length})
                </button>
                {showHidden &&
                  hiddenFolders.map((folder) => (
                    <div key={folder} className="flex items-center gap-2 px-3 py-1 text-xs">
                      <span title={folder} className="min-w-0 flex-1 truncate text-slate-500">
                        {folder.split(/[\\/]/).pop() || folder}
                      </span>
                      <button
                        type="button"
                        onClick={() => onRestore(folder)}
                        className="shrink-0 rounded px-2 py-0.5 text-sky-400 transition hover:bg-slate-800"
                      >
                        Restaurar
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </>
        )}
      </nav>
    </aside>
  )
}

export default Sidebar
