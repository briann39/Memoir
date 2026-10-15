import { useEffect, useState } from 'react'
import { cleanError } from '../errors'
import { targetKey } from '../library'

const KINDS = [
  { kind: 'personas', icon: '👤', title: 'Personas', nueva: 'Nueva persona' },
  { kind: 'mascotas', icon: '🐾', title: 'Mascotas', nueva: 'Nueva mascota' },
]

function FolderList({ icon, kind, names, lastUsed, onPick }) {
  return names.map((name) => {
    const last = targetKey(kind, name) === lastUsed
    return (
      <li key={name}>
        <button
          type="button"
          onClick={() => onPick(kind, name)}
          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-slate-700 ${
            last ? 'bg-slate-800 text-sky-300' : 'bg-slate-800/50'
          }`}
        >
          <span aria-hidden>{icon}</span>
          <span className="min-w-0 flex-1 truncate">{name}</span>
          {last && <span className="text-xs text-slate-500">última</span>}
        </button>
      </li>
    )
  })
}

// Elegir en qué carpeta del servidor (persona o mascota) se guardan las fotos
function SendDialog({ serverFolder, lastUsed, count, onPick, onClose }) {
  const api = window.electronAPI
  const [folders, setFolders] = useState(null) // { personas, mascotas, otras }
  const [error, setError] = useState(null)
  const [names, setNames] = useState({ personas: '', mascotas: '' })

  useEffect(() => {
    let stale = false
    api
      .serverFolders(serverFolder)
      .then((list) => {
        if (!stale) setFolders(list)
      })
      .catch((err) => {
        if (!stale) setError(cleanError(err))
      })
    return () => {
      stale = true
    }
  }, [api, serverFolder])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Enviar al servidor"
        className="flex max-h-[85vh] w-96 flex-col gap-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">
          Enviar {count === 1 ? 'la foto' : `${count} fotos`} a…
        </h2>

        {error ? (
          <p className="text-sm text-red-300">{error}</p>
        ) : !folders ? (
          <p className="text-sm text-slate-400">Conectando con el servidor…</p>
        ) : (
          <div className="-mx-1 min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
            {KINDS.map(({ kind, icon, title, nueva }) => (
              <section key={kind} className="space-y-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {icon} {title}
                </h3>
                <ul className="space-y-1">
                  {folders[kind].length === 0 && (
                    <li className="px-1 text-sm text-slate-500">Todavía no hay ninguna.</li>
                  )}
                  <FolderList
                    icon={icon}
                    kind={kind}
                    names={folders[kind]}
                    lastUsed={lastUsed}
                    onPick={onPick}
                  />
                </ul>
                <form
                  className="flex gap-2 pt-1"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const name = names[kind].trim()
                    if (name) onPick(kind, name)
                  }}
                >
                  <input
                    value={names[kind]}
                    onChange={(e) => setNames((n) => ({ ...n, [kind]: e.target.value }))}
                    placeholder={nueva}
                    maxLength={100}
                    className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm outline-none focus:border-sky-400"
                  />
                  <button
                    type="submit"
                    disabled={!names[kind].trim()}
                    className="rounded-lg bg-sky-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-sky-400 disabled:opacity-50"
                  >
                    Crear y enviar
                  </button>
                </form>
              </section>
            ))}

            {folders.otras.length > 0 && (
              <section className="space-y-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  📁 Otras carpetas
                </h3>
                <ul className="space-y-1">
                  <FolderList
                    icon="📁"
                    kind="otras"
                    names={folders.otras}
                    lastUsed={lastUsed}
                    onPick={onPick}
                  />
                </ul>
              </section>
            )}

            <button
              type="button"
              onClick={() => onPick('', '')}
              className="w-full rounded-lg px-3 py-2 text-left text-xs text-slate-500 transition hover:bg-slate-800"
            >
              Sin carpeta (raíz del servidor)
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="self-end rounded-lg px-3 py-1.5 text-sm text-slate-400 transition hover:bg-slate-800"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

export default SendDialog
