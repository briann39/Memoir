import { useEffect, useRef, useState } from 'react'
import { FolderPlus, X } from 'lucide-react'
import { api } from '../api'
import { useDialogs } from '../dialogs-context'

const THEMES = [
  ['system', 'Automático'],
  ['light', 'Claro'],
  ['dark', 'Oscuro'],
]

const SAVE_MODES = [
  ['copy', 'Guardar una copia'],
  ['replace', 'Reemplazar la original'],
]

function Section({ title, children }) {
  return (
    <section className="space-y-4 border-t border-linea py-5 first:border-t-0 first:pt-0">
      <h3 className="font-serif text-xl">{title}</h3>
      {children}
    </section>
  )
}

// Una fila: nombre y explicación a la izquierda, el control a la derecha
function Row({ label, hint, htmlFor, children }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="font-bold">
          {label}
        </label>
        {hint && <p className="text-sm text-suave">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

// Varias opciones de las que se elige una
function Segmented({ label, value, options, onChange }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-md border border-linea bg-panel p-0.5">
      {options.map(([key, text]) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          onClick={() => onChange(key)}
          className={`rounded px-3 py-1.5 transition ${
            value === key ? 'bg-acento font-bold text-sobre-acento' : 'text-suave hover:text-tinta'
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

function Switch({ id, checked, onChange }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full border transition ${
        checked ? 'border-acento bg-acento' : 'border-linea bg-panel'
      }`}
    >
      <span
        aria-hidden
        className={`absolute top-0.5 size-4.5 rounded-full transition-all ${
          checked ? 'left-5.5 bg-sobre-acento' : 'left-0.5 bg-suave'
        }`}
      />
    </button>
  )
}

// El tamaño mínimo se aplica al terminar de escribir, no en cada tecla
function MinSize({ value, onChange }) {
  const [draft, setDraft] = useState(String(value))
  const commit = () => {
    const kb = Math.min(Math.max(Math.round(Number(draft)) || 0, 0), 5000)
    setDraft(String(kb))
    if (kb !== value) onChange(kb)
  }
  return (
    <div className="flex items-center gap-2">
      <input
        id="min-kb"
        type="number"
        min={0}
        max={5000}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        className="w-24 rounded-md border border-linea bg-elevado px-3 py-1.5 text-right"
      />
      <span className="text-suave">KB</span>
    </div>
  )
}

function SettingsDialog({ settings, serverFolder, serverState, onChange, onServerFolder, onPickServerFolder, onRescan, onReset, onClose }) {
  const { confirm } = useDialogs()
  const boxRef = useRef(null)

  // Esc y clic fuera cierran; al abrir, el foco va al cuadro
  useEffect(() => {
    const before = document.activeElement
    boxRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      before?.focus?.()
    }
  }, [onClose])

  const addRoot = async () => {
    const picked = await api.selectFolders()
    const roots = [...new Set([...settings.scanRoots, ...picked])]
    if (roots.length !== settings.scanRoots.length) onChange('scanRoots', roots)
  }

  const reset = async () => {
    const ok = await confirm({
      title: '¿Restablecer la configuración?',
      body: 'Vuelven los valores iniciales. Tus fotos, álbumes, personas y etiquetas no cambian.',
      confirmLabel: 'Restablecer',
      tone: 'danger',
    })
    if (ok) onReset()
  }

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={boxRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-lg border border-linea bg-elevado shadow-2xl outline-none"
      >
        <header className="flex items-center justify-between border-b border-linea px-6 py-4">
          <h2 id="settings-title" className="font-serif text-3xl leading-none">
            Configuración
          </h2>
          <button
            type="button"
            aria-label="Cerrar la configuración"
            onClick={onClose}
            className="rounded-md p-1.5 text-suave transition hover:bg-linea/40 hover:text-tinta"
          >
            <X size={20} aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <Section title="Apariencia">
            <Row label="Tema" hint="«Automático» sigue el modo claro u oscuro de Windows.">
              <Segmented label="Tema" value={settings.theme} options={THEMES} onChange={(v) => onChange('theme', v)} />
            </Row>
          </Section>

          <Section title="Fotos de este equipo">
            <Row label="Buscar al abrir la app" hint="Si lo apagas, la búsqueda empieza cuando pulses «Buscar de nuevo».">
              <Switch id="scan-start" checked={settings.scanOnStart} onChange={(v) => onChange('scanOnStart', v)} />
            </Row>

            <div className="space-y-2">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="font-bold">Carpetas donde buscar</p>
                  <p className="text-sm text-suave">Si no eliges ninguna, se busca en tu carpeta de usuario.</p>
                </div>
                <button
                  type="button"
                  onClick={addRoot}
                  className="flex shrink-0 items-center gap-2 rounded-md border border-linea px-3 py-1.5 transition hover:border-acento"
                >
                  <FolderPlus size={16} aria-hidden />
                  Agregar carpeta
                </button>
              </div>
              {settings.scanRoots.length > 0 && (
                <ul className="divide-y divide-linea rounded-md border border-linea">
                  {settings.scanRoots.map((root) => (
                    <li key={root} className="flex items-center gap-2 px-3 py-1.5">
                      <span title={root} className="min-w-0 flex-1 truncate">
                        {root}
                      </span>
                      <button
                        type="button"
                        aria-label={`Quitar ${root}`}
                        onClick={() => onChange('scanRoots', settings.scanRoots.filter((r) => r !== root))}
                        className="rounded p-1 text-suave transition hover:text-peligro"
                      >
                        <X size={14} aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Row
              label="Tamaño mínimo de las fotos"
              hint="Las más pequeñas (iconos, miniaturas) no se muestran."
              htmlFor="min-kb"
            >
              <MinSize value={settings.minKb} onChange={(v) => onChange('minKb', v)} />
            </Row>

            <div className="flex items-center justify-between gap-4 rounded-md bg-panel px-4 py-3">
              <p className="text-sm text-suave">Los cambios de carpetas y de tamaño se aplican al buscar de nuevo.</p>
              <button
                type="button"
                onClick={() => {
                  onRescan()
                  onClose()
                }}
                className="shrink-0 rounded-md bg-acento px-3 py-1.5 font-bold text-sobre-acento transition hover:opacity-90"
              >
                Buscar de nuevo
              </button>
            </div>
          </Section>

          <Section title="Servidor">
            <div className="space-y-2">
              <label htmlFor="server-folder" className="font-bold">
                Carpeta del servidor
              </label>
              <p className="text-sm text-suave">
                Una carpeta de red o una unidad donde se guardan tus álbumes y los datos de las fotos.
              </p>
              <div className="flex gap-2">
                <input
                  id="server-folder"
                  key={serverFolder}
                  defaultValue={serverFolder}
                  onBlur={(e) => onServerFolder(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  placeholder="\\servidor\fotos"
                  className="min-w-0 flex-1 rounded-md border border-linea bg-elevado px-3 py-1.5 placeholder:text-suave"
                />
                <button
                  type="button"
                  onClick={onPickServerFolder}
                  className="shrink-0 rounded-md border border-linea px-3 py-1.5 transition hover:border-acento"
                >
                  Elegir carpeta
                </button>
              </div>
              {serverFolder && (
                <p className="text-sm text-suave" role="status">
                  {{ ready: 'Conectado.', scanning: 'Conectado. Leyendo los álbumes…', offline: 'Sin conexión con el servidor.' }[
                    serverState
                  ] ?? 'Conectando…'}
                </p>
              )}
            </div>
          </Section>

          <Section title="Edición de fotos">
            <Row label="Al guardar una edición" hint="Reemplazar manda la original a la Papelera. En el servidor solo se guardan copias.">
              <Segmented
                label="Al guardar una edición"
                value={settings.saveMode}
                options={SAVE_MODES}
                onChange={(v) => onChange('saveMode', v)}
              />
            </Row>
            <Row label="Calidad de JPG y WebP" hint="Más calidad pesa más. 92 es un buen equilibrio." htmlFor="quality">
              <div className="flex items-center gap-3">
                <input
                  id="quality"
                  type="range"
                  min={50}
                  max={100}
                  value={settings.jpegQuality}
                  onChange={(e) => onChange('jpegQuality', Number(e.target.value))}
                  className="w-40 accent-acento"
                />
                <output className="w-8 text-right font-bold">{settings.jpegQuality}</output>
              </div>
            </Row>
          </Section>

          <Section title="Datos">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => api.openDataFolder()}
                className="rounded-md border border-linea px-3 py-1.5 transition hover:border-acento"
              >
                Abrir la carpeta de datos
              </button>
              <button
                type="button"
                onClick={reset}
                className="rounded-md border border-linea px-3 py-1.5 transition hover:border-peligro hover:text-peligro"
              >
                Restablecer la configuración
              </button>
            </div>
            <p className="text-sm text-suave">
              La carpeta de datos guarda tus álbumes, etiquetas y ajustes. Cópiala si quieres hacer una copia de seguridad.
            </p>
          </Section>
        </div>

        <footer className="flex justify-end border-t border-linea px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-acento px-5 py-2 font-bold text-sobre-acento transition hover:opacity-90"
          >
            Listo
          </button>
        </footer>
      </div>
    </div>
  )
}

export default SettingsDialog
