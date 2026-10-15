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
  people,
  filterIds,
  filterMode,
  filterEntry,
  onToggleFilter,
  onFilterMode,
  serverFolders,
  serverState,
  serverError,
  onRetryServer,
  scanning,
  canScan,
  expanded,
  filesByKey,
  selected,
  onToggle,
  onHide,
  onRestore,
  onDropImage,
  pendingCount,
  toDelete,
  sending,
  progress,
  onSendAll,
  onDeleteMarked,
  onClearDeleteMarks,
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
  const serverVisible = serverFolders
    .filter((f) => f.name.toLowerCase().includes(term))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  const serverTotal = serverFolders.reduce((sum, f) => sum + f.count, 0)

  // Entrada desplegable: carpeta real o colección virtual (álbum, etiqueta, imágenes sueltas)
  const renderEntry = (f) => {
    const isOpen = expanded.has(f.path)
    const files = filesByKey[f.path]
    const canDrag = f.path !== '__loose__' // las imágenes sueltas no tienen ruta en el disco
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
          {!f.virtual && !f.server && (
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
                    draggable={canDrag}
                    onDragStart={(e) => startImageDrag(e, img.id)}
                    onClick={() => onPick(f.path, i)}
                    className={`flex w-full items-center gap-1 rounded px-3 py-1 text-left text-xs transition hover:bg-slate-800 ${
                      active ? 'bg-slate-800 text-sky-400' : 'text-slate-300'
                    }`}
                  >
                    <span
                      className={`min-w-0 flex-1 truncate ${
                        toDelete.has(img.id) ? 'text-red-300 line-through' : ''
                      }`}
                    >
                      {img.name}
                    </span>
                    {toDelete.has(img.id) && (
                      <span title="Marcada para eliminar" aria-label="Marcada para eliminar">
                        🗑
                      </span>
                    )}
                    {img.cloud && (
                      <span title="Solo en la nube" aria-label="Solo en la nube">
                        ☁️
                      </span>
                    )}
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

        {people.length > 0 && (
          <>
            <SectionTitle>Buscar por personas</SectionTitle>
            <div className="flex flex-wrap gap-1.5 px-3 pb-2">
              {people.map((p) => {
                const on = filterIds.includes(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onToggleFilter(p.id)}
                    className={`rounded-full px-2.5 py-1 text-xs transition ${
                      on ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {p.kind === 'mascota' ? '🐾' : '👤'} {p.name}
                  </button>
                )
              })}
            </div>
            {filterIds.length > 1 && (
              <div className="flex gap-1 px-3 pb-2 text-xs" role="group" aria-label="Cómo combinar">
                {[
                  ['all', 'Salen todas'],
                  ['any', 'Sale alguna'],
                ].map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={filterMode === mode}
                    onClick={() => onFilterMode(mode)}
                    className={`flex-1 rounded px-2 py-1 transition ${
                      filterMode === mode ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:bg-slate-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {filterEntry && renderEntry(filterEntry)}
          </>
        )}

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

        {serverState !== 'none' && (
          <>
            <div className="flex items-center justify-between gap-2 pr-1">
              <SectionTitle>Servidor</SectionTitle>
              {serverState === 'offline' && (
                <button
                  type="button"
                  onClick={onRetryServer}
                  className="mt-2 shrink-0 rounded px-2 py-0.5 text-xs text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
                >
                  Reintentar
                </button>
              )}
            </div>
            {serverState === 'offline' ? (
              <p className="px-3 pb-2 text-xs text-amber-400">
                {serverError ?? 'Sin conexión con el servidor.'}
              </p>
            ) : (
              <>
                <p className="px-3 pb-1 text-xs text-slate-500">
                  {serverState === 'ready'
                    ? `${serverFolders.length} álbumes · ${serverTotal} fotos`
                    : 'Conectando…'}
                </p>
                {serverState === 'ready' && serverVisible.length === 0 && (
                  <p className="px-3 pb-2 text-xs text-slate-500">
                    {serverFolders.length === 0
                      ? 'Todavía no hay álbumes en el servidor.'
                      : 'Ningún álbum coincide.'}
                  </p>
                )}
                {serverVisible.map((f) => renderEntry({ ...f, server: true, icon: '🗄️' }))}
              </>
            )}
          </>
        )}

        {canScan && (
          <>
            <div className="flex items-center justify-between gap-2 pr-1">
              <SectionTitle>Carpetas del equipo</SectionTitle>
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

      {(pendingCount > 0 || toDelete.size > 0 || sending) && (
        <div className="space-y-3 border-t border-slate-800 bg-slate-900 p-3">
          {sending && progress && (
            <p className="text-sm">
              {progress.label} {progress.done} de {progress.total}…
            </p>
          )}

          {toDelete.size > 0 && (
            <div className="space-y-2">
              <p className="text-sm">
                {toDelete.size} {toDelete.size === 1 ? 'foto marcada' : 'fotos marcadas'} para eliminar
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={sending}
                  onClick={onDeleteMarked}
                  className="flex-1 rounded-lg bg-red-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-400 disabled:opacity-50"
                >
                  🗑 Eliminar todas
                </button>
                <button
                  type="button"
                  disabled={sending}
                  onClick={onClearDeleteMarks}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-sm transition hover:bg-slate-800 disabled:opacity-50"
                >
                  Quitar marcas
                </button>
              </div>
            </div>
          )}

          {pendingCount > 0 && (
            <div className="space-y-2">
              <p className="text-sm">
                {pendingCount} {pendingCount === 1 ? 'foto lista' : 'fotos listas'} para enviar
              </p>
              <button
                type="button"
                disabled={sending}
                onClick={onSendAll}
                className="w-full rounded-lg bg-sky-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-400 disabled:opacity-50"
              >
                📤 Enviar todas
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  )
}

export default Sidebar
