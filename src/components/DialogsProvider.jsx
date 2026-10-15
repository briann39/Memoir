import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DialogsContext } from '../dialogs-context'

// Cuadros de diálogo propios: reemplazan a confirm() y alert() del sistema para que todo se vea igual
// y para que las acciones destructivas pongan el foco en «Cancelar».
function DialogsProvider({ children }) {
  const [dialog, setDialog] = useState(null)
  const boxRef = useRef(null)

  const open = useCallback((options) => new Promise((resolve) => setDialog({ ...options, resolve })), [])
  const api = useMemo(
    () => ({
      confirm: (options) => open({ ...options, kind: 'confirm' }),
      alert: (options) => open({ ...options, kind: 'alert' }),
    }),
    [open],
  )

  const close = useCallback(
    (result) => {
      dialog?.resolve(result)
      setDialog(null)
    },
    [dialog],
  )

  // Foco: al abrir va al botón seguro y al cerrar vuelve a donde estaba. Tab no sale del cuadro.
  useEffect(() => {
    if (!dialog) return
    const before = document.activeElement
    const buttons = () => [...boxRef.current.querySelectorAll('button')]
    const safe = dialog.tone === 'danger' ? buttons()[0] : buttons().at(-1)
    safe?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        close(false)
      }
      if (e.key === 'Tab') {
        const list = buttons()
        const first = list[0]
        const last = list.at(-1)
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      before?.focus?.()
    }
  }, [dialog, close])

  const danger = dialog?.tone === 'danger'

  return (
    <DialogsContext.Provider value={api}>
      {children}
      {dialog && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          onMouseDown={(e) => e.target === e.currentTarget && close(false)}
        >
          <div
            ref={boxRef}
            role={dialog.kind === 'confirm' ? 'alertdialog' : 'dialog'}
            aria-modal="true"
            aria-labelledby="dialog-title"
            aria-describedby="dialog-body"
            className="w-full max-w-md rounded-lg border border-linea bg-elevado p-6 shadow-2xl"
          >
            <h2 id="dialog-title" className="font-serif text-2xl leading-tight">
              {dialog.title}
            </h2>
            <div id="dialog-body" className="mt-3 space-y-3 text-suave">
              {dialog.body && <p className="whitespace-pre-line">{dialog.body}</p>}
              {dialog.items && (
                <dl className="divide-y divide-linea rounded-md border border-linea text-tinta">
                  {dialog.items.map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-4 px-3 py-2">
                      <dt className="min-w-0 truncate">{item.label}</dt>
                      <dd className="shrink-0 font-bold">
                        {item.kbd ? (
                          <kbd className="rounded border border-linea bg-panel px-1.5 py-0.5 font-sans text-sm font-normal">
                            {item.value}
                          </kbd>
                        ) : (
                          item.value
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              {dialog.note && <p className="whitespace-pre-line text-sm">{dialog.note}</p>}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              {dialog.kind === 'confirm' && (
                <button
                  type="button"
                  onClick={() => close(false)}
                  className="rounded-md border border-linea px-4 py-2 transition hover:bg-panel"
                >
                  {dialog.cancelLabel ?? 'Cancelar'}
                </button>
              )}
              <button
                type="button"
                onClick={() => close(true)}
                className={`rounded-md px-4 py-2 font-bold transition ${
                  danger
                    ? 'bg-peligro text-sobre-acento hover:opacity-90'
                    : 'bg-acento text-sobre-acento hover:opacity-90'
                }`}
              >
                {dialog.confirmLabel ?? (dialog.kind === 'confirm' ? 'Aceptar' : 'Entendido')}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogsContext.Provider>
  )
}

export default DialogsProvider
