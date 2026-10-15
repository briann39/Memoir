import { useEffect, useState } from 'react'
import { cleanError } from '../errors'

// Elegir en qué carpeta del servidor (persona, animal…) se guarda la foto
function SendDialog({ serverFolder, lastUsed, onPick, onClose }) {
  const api = window.electronAPI
  const [folders, setFolders] = useState(null)
  const [error, setError] = useState(null)
  const [name, setName] = useState('')

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

  // La última carpeta usada va primero
  const ordered = folders && [
    ...folders.filter((f) => f === lastUsed),
    ...folders.filter((f) => f !== lastUsed),
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Enviar al servidor"
        className="flex max-h-[80vh] w-96 flex-col gap-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">Enviar a…</h2>

        {error ? (
          <p className="text-sm text-red-300">{error}</p>
        ) : !ordered ? (
          <p className="text-sm text-slate-400">Conectando con el servidor…</p>
        ) : (
          <ul className="-mx-1 min-h-0 flex-1 space-y-1 overflow-y-auto px-1">
            {ordered.length === 0 && (
              <li className="text-sm text-slate-500">
                Todavía no hay carpetas. Crea la primera abajo.
              </li>
            )}
            {ordered.map((f) => (
              <li key={f}>
                <button
                  type="button"
                  onClick={() => onPick(f)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-slate-700 ${
                    f === lastUsed ? 'bg-slate-800 text-sky-300' : 'bg-slate-800/50'
                  }`}
                >
                  <span aria-hidden>📁</span>
                  <span className="min-w-0 flex-1 truncate">{f}</span>
                  {f === lastUsed && <span className="text-xs text-slate-500">última</span>}
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => onPick('')}
                className="w-full rounded-lg px-3 py-2 text-left text-xs text-slate-500 transition hover:bg-slate-800"
              >
                Sin carpeta (raíz del servidor)
              </button>
            </li>
          </ul>
        )}

        {!error && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (name.trim()) onPick(name.trim())
            }}
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nueva carpeta (persona o animal)"
              maxLength={100}
              className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-sky-400"
            />
            <button
              type="submit"
              disabled={!name.trim()}
              className="rounded-lg bg-sky-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-400 disabled:opacity-50"
            >
              Crear y enviar
            </button>
          </form>
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
