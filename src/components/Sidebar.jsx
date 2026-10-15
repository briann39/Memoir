import { useState } from 'react'
import {
  Cloud,
  Folder,
  FolderOpen,
  FolderPlus,
  Image as ImageIcon,
  ImagePlus,
  Images,
  Keyboard,
  PawPrint,
  RotateCw,
  Search,
  Send,
  Server,
  Tag,
  Trash2,
  TriangleAlert,
  User,
  X,
  ChevronRight,
} from 'lucide-react'
import { dropTarget, startImageDrag } from '../dnd'

const ICONS = {
  album: Images,
  persona: User,
  mascota: PawPrint,
  tag: Tag,
  filter: Search,
  loose: ImageIcon,
  server: Server,
}

const n = (value) => value.toLocaleString('es')

function Heading({ children, aside }) {
  return (
    <div className="flex items-center justify-between gap-2 px-2 pb-1 pt-5">
      <h2 className="text-sm font-bold text-suave">{children}</h2>
      {aside}
    </div>
  )
}

function TextButton({ onClick, icon: Icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-sm text-suave transition hover:bg-linea/50 hover:text-tinta"
    >
      {Icon && <Icon size={14} aria-hidden />}
      {children}
    </button>
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
  onCancel,
  onShowShortcuts,
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
  const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })
  const visible = folders
    .filter((f) => f.name.toLowerCase().includes(term) || f.path.toLowerCase().includes(term))
    .sort(byName)
  const total = folders.reduce((sum, f) => sum + f.count, 0)
  const serverVisible = serverFolders.filter((f) => f.name.toLowerCase().includes(term)).sort(byName)
  const serverTotal = serverFolders.reduce((sum, f) => sum + f.count, 0)

  // Entrada desplegable: carpeta real o colección (álbum, etiqueta, persona, resultado, imágenes sueltas)
  const renderEntry = (f) => {
    const isOpen = expanded.has(f.path)
    const files = filesByKey[f.path]
    const canDrag = f.path !== '__loose__' // las imágenes sueltas no tienen ruta en el disco
    const Icon = ICONS[f.kind] ?? (isOpen ? FolderOpen : Folder)
    return (
      <div key={f.path}>
        <div
          className={`group flex items-center rounded-md transition ${
            dropKey === f.path ? 'bg-acento-suave ring-2 ring-acento' : 'hover:bg-linea/40'
          }`}
          {...(f.albumId &&
            dropTarget(
              (over) => setDropKey(over ? f.path : null),
              (file) => onDropImage(f.albumId, file),
            ))}
        >
          <button
            type="button"
            title={f.kind ? f.name : f.path}
            aria-expanded={isOpen}
            onClick={() => onToggle(f)}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left"
          >
            <ChevronRight
              size={14}
              aria-hidden
              className={`shrink-0 text-suave transition-transform ${isOpen ? 'rotate-90' : ''}`}
            />
            <Icon size={16} aria-hidden className="shrink-0 text-suave" />
            <span className="min-w-0 flex-1 truncate">{f.name}</span>
            <span className="shrink-0 text-sm text-suave">{n(f.count)}</span>
          </button>
          {!f.kind && !f.server && (
            <button
              type="button"
              title="Descartar esta carpeta del visor"
              aria-label={`Descartar ${f.name}`}
              onClick={() => onHide(f)}
              className="mr-1 rounded p-1 text-suave opacity-0 transition hover:text-peligro focus:opacity-100 group-hover:opacity-100"
            >
              <X size={14} aria-hidden />
            </button>
          )}
        </div>

        {isOpen && (
          <ul className="mb-1 ml-5 border-l border-linea pl-1">
            {!files && <li className="px-3 py-1 text-sm text-suave">Cargando…</li>}
            {files?.length === 0 && <li className="px-3 py-1 text-sm text-suave">No hay fotos aquí.</li>}
            {files?.map((img, i) => {
              const active = selected?.key === f.path && selected.index === i
              const marked = toDelete.has(img.id)
              return (
                <li key={img.id}>
                  <button
                    type="button"
                    title={img.name}
                    draggable={canDrag}
                    onDragStart={(e) => startImageDrag(e, img.id)}
                    onClick={() => onPick(f.path, i)}
                    aria-current={active ? 'true' : undefined}
                    className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-sm transition ${
                      active ? 'bg-acento-suave font-bold text-acento' : 'hover:bg-linea/40'
                    }`}
                  >
                    <span className={`min-w-0 flex-1 truncate ${marked ? 'text-peligro line-through' : ''}`}>
                      {img.name}
                    </span>
                    {marked && <Trash2 size={13} aria-label="Marcada para eliminar" className="shrink-0 text-peligro" />}
                    {img.cloud && <Cloud size={13} aria-label="Solo en la nube" className="shrink-0 text-suave" />}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    )
  }

  const pct = progress ? Math.round((progress.done / Math.max(progress.total, 1)) * 100) : 0

  return (
    <aside className="flex w-88 shrink-0 flex-col border-r border-linea bg-panel">
      <div className="space-y-3 p-4 pb-2">
        <h1 className="font-serif text-3xl leading-none tracking-tight">Memoir</h1>
        <div className={`grid gap-2 ${canScan ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {canScan && (
            <button
              type="button"
              onClick={onAddFolder}
              className="flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-linea bg-elevado px-3 py-2 transition hover:border-acento"
            >
              <FolderPlus size={16} aria-hidden />
              Agregar carpeta
            </button>
          )}
          <button
            type="button"
            onClick={onOpenFiles}
            className="flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-linea bg-elevado px-3 py-2 transition hover:border-acento"
          >
            <ImagePlus size={16} aria-hidden />
            Abrir fotos
          </button>
        </div>
        {canScan && (
          <label className="relative block">
            <span className="sr-only">Buscar carpeta o álbum</span>
            <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-suave" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar carpeta o álbum"
              className="w-full rounded-md border border-linea bg-elevado py-2 pl-9 pr-3 placeholder:text-suave"
            />
          </label>
        )}
      </div>

      <nav aria-label="Biblioteca" className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {looseCount > 0 &&
          renderEntry({ path: '__loose__', name: 'Fotos sueltas', count: looseCount, kind: 'loose' })}

        {people.length > 0 && (
          <>
            <Heading>Buscar por personas</Heading>
            <div className="flex flex-wrap gap-1.5 px-2 pb-2">
              {people.map((p) => {
                const on = filterIds.includes(p.id)
                const Icon = p.kind === 'mascota' ? PawPrint : User
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onToggleFilter(p.id)}
                    className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm transition ${
                      on
                        ? 'border-acento bg-acento text-sobre-acento'
                        : 'border-linea bg-elevado hover:border-acento'
                    }`}
                  >
                    <Icon size={13} aria-hidden />
                    {p.name}
                  </button>
                )
              })}
            </div>
            {filterIds.length > 1 && (
              <div
                role="group"
                aria-label="Cómo combinar las personas elegidas"
                className="mx-2 mb-2 grid grid-cols-2 rounded-md border border-linea bg-elevado p-0.5 text-sm"
              >
                {[
                  ['all', 'Salen todas'],
                  ['any', 'Sale alguna'],
                ].map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={filterMode === mode}
                    onClick={() => onFilterMode(mode)}
                    className={`rounded px-2 py-1 transition ${
                      filterMode === mode ? 'bg-acento-suave font-bold text-acento' : 'text-suave hover:text-tinta'
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
            <Heading>Álbumes</Heading>
            {albums.map(renderEntry)}
          </>
        )}

        {tags.length > 0 && (
          <>
            <Heading>Personas y etiquetas</Heading>
            {tags.map(renderEntry)}
          </>
        )}

        {serverState !== 'none' && (
          <>
            <Heading
              aside={
                serverState === 'offline' && (
                  <TextButton onClick={onRetryServer} icon={RotateCw}>
                    Reintentar
                  </TextButton>
                )
              }
            >
              Servidor
            </Heading>
            {serverState === 'offline' ? (
              <p className="mx-2 flex gap-2 rounded-md bg-peligro-suave p-2 text-sm text-peligro">
                <TriangleAlert size={16} aria-hidden className="mt-0.5 shrink-0" />
                {serverError ?? 'No hay conexión con el servidor.'}
              </p>
            ) : (
              <>
                <p className="px-2 pb-1 text-sm text-suave">
                  {serverState === 'ready'
                    ? `${n(serverFolders.length)} álbumes, ${n(serverTotal)} fotos`
                    : 'Conectando con el servidor…'}
                </p>
                {serverState === 'ready' && serverVisible.length === 0 && (
                  <p className="px-2 pb-2 text-sm text-suave">
                    {serverFolders.length === 0
                      ? 'Todavía no hay álbumes en el servidor.'
                      : 'Ningún álbum coincide con la búsqueda.'}
                  </p>
                )}
                {serverVisible.map((f) => renderEntry({ ...f, server: true, kind: 'server' }))}
              </>
            )}
          </>
        )}

        {canScan && (
          <>
            <Heading
              aside={
                scanning ? (
                  <TextButton onClick={onStop}>Detener</TextButton>
                ) : (
                  <TextButton onClick={onRescan} icon={RotateCw}>
                    Buscar de nuevo
                  </TextButton>
                )
              }
            >
              Carpetas del equipo
            </Heading>
            <p className="px-2 pb-1 text-sm text-suave">
              {scanning ? 'Buscando fotos en el equipo…' : `${n(folders.length)} carpetas, ${n(total)} fotos`}
            </p>
            {visible.length === 0 && !scanning && (
              <p className="px-2 py-4 text-sm text-suave">
                {folders.length === 0
                  ? 'No se encontraron fotos. Usa «Agregar carpeta» para buscar en otro lugar.'
                  : 'Ninguna carpeta coincide con la búsqueda.'}
              </p>
            )}
            {visible.map(renderEntry)}

            {hiddenFolders.length > 0 && (
              <div className="mt-4 border-t border-linea pt-2">
                <button
                  type="button"
                  aria-expanded={showHidden}
                  onClick={() => setShowHidden((v) => !v)}
                  className="flex w-full items-center gap-1 rounded px-2 py-1 text-left text-sm text-suave transition hover:bg-linea/40"
                >
                  <ChevronRight
                    size={14}
                    aria-hidden
                    className={`transition-transform ${showHidden ? 'rotate-90' : ''}`}
                  />
                  Carpetas descartadas ({hiddenFolders.length})
                </button>
                {showHidden &&
                  hiddenFolders.map((folder) => (
                    <div key={folder} className="flex items-center gap-2 px-2 py-1 text-sm">
                      <span title={folder} className="min-w-0 flex-1 truncate text-suave">
                        {folder.split(/[\\/]/).pop() || folder}
                      </span>
                      <TextButton onClick={() => onRestore(folder)}>Restaurar</TextButton>
                    </div>
                  ))}
              </div>
            )}
          </>
        )}
      </nav>

      <div className="space-y-3 border-t border-linea p-3">
        {sending && progress && (
          <div role="status" className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p>
                {progress.label} {n(progress.done)} de {n(progress.total)}
              </p>
              <TextButton onClick={onCancel}>Cancelar</TextButton>
            </div>
            <div
              role="progressbar"
              aria-label={progress.label}
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-valuenow={progress.done}
              className="h-1.5 overflow-hidden rounded-full bg-linea"
            >
              <div className="h-full rounded-full bg-acento transition-[width]" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        {!sending && toDelete.size > 0 && (
          <div className="space-y-2">
            <p>
              {n(toDelete.size)} {toDelete.size === 1 ? 'foto marcada' : 'fotos marcadas'} para eliminar
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onDeleteMarked}
                className="flex flex-1 items-center justify-center gap-2 rounded-md bg-peligro px-3 py-2 font-bold text-sobre-acento transition hover:opacity-90"
              >
                <Trash2 size={16} aria-hidden />
                Eliminar
              </button>
              <button
                type="button"
                onClick={onClearDeleteMarks}
                className="rounded-md border border-linea px-3 py-2 transition hover:bg-linea/40"
              >
                Quitar marcas
              </button>
            </div>
          </div>
        )}

        {!sending && pendingCount > 0 && (
          <div className="space-y-2">
            <p>
              {n(pendingCount)} {pendingCount === 1 ? 'foto lista' : 'fotos listas'} para el servidor
            </p>
            <button
              type="button"
              onClick={onSendAll}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-acento px-3 py-2 font-bold text-sobre-acento transition hover:opacity-90"
            >
              <Send size={16} aria-hidden />
              Enviar al servidor
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onShowShortcuts}
          className="flex items-center gap-2 rounded px-1 py-0.5 text-sm text-suave transition hover:text-tinta"
        >
          <Keyboard size={14} aria-hidden />
          Atajos de teclado
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
