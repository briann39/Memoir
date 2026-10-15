import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Crop,
  FlipHorizontal2,
  FlipVertical2,
  LoaderCircle,
  Redo2,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  Undo2,
} from 'lucide-react'
import { api } from '../api'
import { useDialogs } from '../dialogs-context'
import {
  ASPECTS,
  aspectCrop,
  clamp,
  cropFromAnchor,
  FILTERS,
  initialEdit,
  isEdited,
  moveCrop,
  outputSize,
  renderOutput,
  renderTransformed,
  rotatedSize,
} from '../editor'
import { cleanError } from '../errors'

const mimeOf = (name) => (/\.png$/i.test(name) ? 'image/png' : /\.webp$/i.test(name) ? 'image/webp' : 'image/jpeg')
const MIN_CROP = 0.03

// El recorte: se dibuja arrastrando sobre la foto, se mueve desde dentro y se ajusta desde las esquinas
function CropOverlay({ crop, ratio, rw, rh, onStart, onChange }) {
  const ref = useRef(null)
  const drag = useRef(null)

  const point = (e) => {
    const box = ref.current.getBoundingClientRect()
    return { x: clamp((e.clientX - box.left) / box.width), y: clamp((e.clientY - box.top) / box.height) }
  }

  const begin = (mode, e, extra = {}) => {
    e.preventDefault()
    e.stopPropagation()
    ref.current.setPointerCapture(e.pointerId)
    drag.current = { mode, start: point(e), crop, started: false, ...extra }
  }

  // El historial se guarda solo cuando el gesto cambia algo de verdad
  const emit = (next) => {
    const d = drag.current
    if (!d.started) {
      onStart()
      d.started = true
    }
    onChange(next)
  }

  const move = (e) => {
    const d = drag.current
    if (!d) return
    const p = point(e)
    if (d.mode === 'move') return emit(moveCrop(d.crop, p.x - d.start.x, p.y - d.start.y))
    const next = cropFromAnchor(d.mode === 'draw' ? d.start : d.anchor, p, ratio, rw, rh)
    if (next.w >= MIN_CROP && next.h >= MIN_CROP) emit(next)
  }

  const end = (e) => {
    drag.current = null
    if (ref.current.hasPointerCapture(e.pointerId)) ref.current.releasePointerCapture(e.pointerId)
  }

  const pct = (v) => `${(v * 100).toFixed(3)}%`
  const corners = crop && [
    ['nw', crop.x, crop.y, { x: crop.x + crop.w, y: crop.y + crop.h }, 'cursor-nwse-resize'],
    ['ne', crop.x + crop.w, crop.y, { x: crop.x, y: crop.y + crop.h }, 'cursor-nesw-resize'],
    ['sw', crop.x, crop.y + crop.h, { x: crop.x + crop.w, y: crop.y }, 'cursor-nesw-resize'],
    ['se', crop.x + crop.w, crop.y + crop.h, { x: crop.x, y: crop.y }, 'cursor-nwse-resize'],
  ]

  return (
    <div
      ref={ref}
      className="absolute inset-0 cursor-crosshair touch-none"
      onPointerDown={(e) => begin('draw', e)}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      {crop && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-black/55"
            style={{
              clipPath: `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${pct(crop.x)} ${pct(crop.y)}, ${pct(crop.x)} ${pct(crop.y + crop.h)}, ${pct(crop.x + crop.w)} ${pct(crop.y + crop.h)}, ${pct(crop.x + crop.w)} ${pct(crop.y)}, ${pct(crop.x)} ${pct(crop.y)})`,
            }}
          />
          <div
            aria-label="Zona que se conserva. Arrástrala para moverla."
            className="absolute cursor-move border-2 border-white"
            style={{ left: pct(crop.x), top: pct(crop.y), width: pct(crop.w), height: pct(crop.h) }}
            onPointerDown={(e) => begin('move', e)}
          >
            <div aria-hidden className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
              {Array.from({ length: 9 }, (_, i) => (
                <div key={i} className="border border-white/30" />
              ))}
            </div>
          </div>
          {corners.map(([name, x, y, anchor, cursor]) => (
            <div
              key={name}
              aria-hidden
              className={`absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-black/50 bg-white ${cursor}`}
              style={{ left: pct(x), top: pct(y) }}
              onPointerDown={(e) => begin('resize', e, { anchor })}
            />
          ))}
        </>
      )}
    </div>
  )
}

function Slider({ id, label, value, onStart, onChange }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label htmlFor={id}>{label}</label>
        <output className="w-10 text-right font-bold">{value > 0 ? `+${value}` : value}</output>
      </div>
      <input
        id={id}
        type="range"
        min={-100}
        max={100}
        value={value}
        onPointerDown={onStart}
        onKeyDown={(e) => !e.repeat && onStart()}
        onChange={(e) => onChange(Number(e.target.value))}
        onDoubleClick={() => onChange(0)}
        title="Doble clic para volver a 0"
        className="w-full accent-acento"
      />
    </div>
  )
}

function ToolButton({ icon: Icon, children, ...props }) {
  return (
    <button
      type="button"
      className="flex flex-col items-center gap-1 rounded-md border border-linea bg-elevado px-2 py-2.5 text-center text-sm transition hover:border-acento"
      {...props}
    >
      <Icon size={20} aria-hidden />
      {children}
    </button>
  )
}

function Group({ icon: Icon, title, children }) {
  return (
    <section className="space-y-3 border-t border-linea pt-4 first:border-t-0 first:pt-0">
      <h3 className="flex items-center gap-2 font-bold">
        <Icon size={16} aria-hidden className="text-suave" />
        {title}
      </h3>
      {children}
    </section>
  )
}

// image: la foto que se edita · settings: calidad y forma de guardar · canReplace: si se puede reemplazar la original
// onSaved({ path, mode }): se llama al guardar bien
function ImageEditor({ image, settings, canReplace, onClose, onSaved }) {
  const dialogs = useDialogs()
  const [bitmap, setBitmap] = useState(null) // la foto completa
  const [small, setSmall] = useState(null) // una versión reducida para la vista previa
  const [loadError, setLoadError] = useState(null)
  const [edit, setEdit] = useState(initialEdit)
  const [past, setPast] = useState([])
  const [future, setFuture] = useState([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const canvasRef = useRef(null)
  const boxRef = useRef(null)

  // Carga la foto (se lee por el proceso principal, así funciona igual con unidades de red)
  useEffect(() => {
    let stale = false
    ;(async () => {
      try {
        const bytes = await api.readImage(image.id)
        const full = await createImageBitmap(new Blob([bytes], { type: mimeOf(image.name) }))
        const scale = Math.min(1, 1600 / Math.max(full.width, full.height))
        const preview =
          scale < 1
            ? await createImageBitmap(full, {
                resizeWidth: Math.round(full.width * scale),
                resizeHeight: Math.round(full.height * scale),
                resizeQuality: 'high',
              })
            : full
        if (stale) return
        setBitmap(full)
        setSmall(preview)
      } catch (err) {
        if (!stale) setLoadError(cleanError(err))
      }
    })()
    return () => {
      stale = true
    }
  }, [image.id, image.name])

  // Lo que cambia el aspecto de la foto (el recorte no la vuelve a dibujar)
  const look = useMemo(
    () => ({
      rotation: edit.rotation,
      flipH: edit.flipH,
      flipV: edit.flipV,
      brightness: edit.brightness,
      contrast: edit.contrast,
      saturation: edit.saturation,
      filter: edit.filter,
    }),
    [edit.rotation, edit.flipH, edit.flipV, edit.brightness, edit.contrast, edit.saturation, edit.filter],
  )

  useEffect(() => {
    if (!small || !canvasRef.current) return
    const drawn = renderTransformed(small, look, 1)
    const target = canvasRef.current
    target.width = drawn.width
    target.height = drawn.height
    target.getContext('2d').drawImage(drawn, 0, 0)
  }, [small, look])

  // Historial para deshacer y rehacer
  const remember = useCallback(() => {
    setPast((p) => [...p.slice(-49), edit])
    setFuture([])
  }, [edit])

  const change = (patch) => {
    remember()
    setEdit((e) => ({ ...e, ...patch }))
  }

  const undo = useCallback(() => {
    if (!past.length) return
    setFuture((f) => [edit, ...f])
    setEdit(past.at(-1))
    setPast((p) => p.slice(0, -1))
  }, [past, edit])

  const redo = useCallback(() => {
    if (!future.length) return
    setPast((p) => [...p, edit])
    setEdit(future[0])
    setFuture((f) => f.slice(1))
  }, [future, edit])

  const requestClose = useCallback(async () => {
    if (saving) return
    if (isEdited(edit)) {
      const ok = await dialogs.confirm({
        title: '¿Descartar los cambios?',
        body: 'Lo que hiciste en esta foto no se guardará.',
        confirmLabel: 'Descartar',
        cancelLabel: 'Seguir editando',
        tone: 'danger',
      })
      if (!ok) return
    }
    onClose()
  }, [saving, edit, dialogs, onClose])

  // Teclado: Esc cierra, Ctrl+Z deshace, Ctrl+Y (o Ctrl+Mayús+Z) rehace
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') requestClose()
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [requestClose, undo, redo])

  useEffect(() => {
    boxRef.current?.focus()
  }, [])

  const [rw, rh] = bitmap ? rotatedSize(bitmap.width, bitmap.height, edit) : [1, 1]
  const ratioOf = (key) => {
    const value = ASPECTS.find(([k]) => k === key)[2]
    return value === 'orig' ? rw / rh : value
  }

  const rotate = (delta) => change({ rotation: (edit.rotation + delta + 360) % 360, crop: null })
  const flip = (axis) => change({ [axis]: !edit[axis], crop: null })

  const chooseAspect = (key) => {
    const ratio = ratioOf(key)
    change({ aspect: key, crop: ratio ? aspectCrop(ratio, rw, rh) : edit.crop })
  }

  const edited = isEdited(edit)
  const [outW, outH] = bitmap ? outputSize(bitmap.width, bitmap.height, edit) : [0, 0]

  const save = async (mode) => {
    if (mode === 'replace') {
      const ok = await dialogs.confirm({
        title: '¿Reemplazar la foto original?',
        body: 'La original irá a la Papelera de reciclaje, donde podrás recuperarla. Si está en una carpeta de iCloud, también se eliminará de iCloud.',
        confirmLabel: 'Reemplazar',
        tone: 'danger',
      })
      if (!ok) return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const canvas = renderOutput(bitmap, edit)
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, mimeOf(image.name), settings.jpegQuality / 100))
      if (!blob) throw new Error('No se pudo crear la foto editada.')
      const path = await api.saveImage(image.id, mode, new Uint8Array(await blob.arrayBuffer()))
      onSaved({ path, mode })
    } catch (err) {
      setSaveError(cleanError(err))
      setSaving(false)
    }
  }

  const primary = settings.saveMode === 'replace' && canReplace ? 'replace' : 'copy'
  const saveLabel = { copy: 'Guardar una copia', replace: 'Reemplazar la original' }
  const other = primary === 'copy' ? 'replace' : 'copy'

  return (
    <div
      ref={boxRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={`Editar ${image.name}`}
      className="fixed inset-0 z-30 flex flex-col bg-mesa outline-none"
    >
      <header className="flex items-center gap-3 border-b border-linea bg-panel px-4 py-2">
        <h2 className="font-serif text-2xl leading-none">Editar</h2>
        <p className="min-w-0 flex-1 truncate text-suave" title={image.name}>
          {image.name}
        </p>
        <button
          type="button"
          title="Deshacer (Ctrl+Z)"
          aria-label="Deshacer"
          disabled={!past.length || saving}
          onClick={undo}
          className="rounded-md border border-linea p-2 transition hover:border-acento disabled:opacity-40"
        >
          <Undo2 size={16} aria-hidden />
        </button>
        <button
          type="button"
          title="Rehacer (Ctrl+Y)"
          aria-label="Rehacer"
          disabled={!future.length || saving}
          onClick={redo}
          className="rounded-md border border-linea p-2 transition hover:border-acento disabled:opacity-40"
        >
          <Redo2 size={16} aria-hidden />
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={requestClose}
          className="rounded-md border border-linea px-4 py-2 transition hover:bg-linea/40 disabled:opacity-40"
        >
          Cancelar
        </button>
        {canReplace && (
          <button
            type="button"
            disabled={!edited || saving || !bitmap}
            onClick={() => save(other)}
            className="rounded-md border border-linea px-4 py-2 transition hover:border-acento disabled:opacity-40"
          >
            {saveLabel[other]}
          </button>
        )}
        <button
          type="button"
          disabled={!edited || saving || !bitmap}
          onClick={() => save(primary)}
          className="flex items-center gap-2 rounded-md bg-acento px-4 py-2 font-bold text-sobre-acento transition hover:opacity-90 disabled:opacity-40"
        >
          {saving && <LoaderCircle size={16} aria-hidden className="animate-spin" />}
          {saving ? 'Guardando…' : saveLabel[primary]}
        </button>
      </header>

      {saveError && (
        <p role="alert" className="bg-peligro-suave px-4 py-2 text-center text-peligro">
          {saveError}
        </p>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="relative grid min-w-0 flex-1 place-items-center overflow-hidden p-6">
          {loadError ? (
            <p className="max-w-md text-center text-suave">{loadError}</p>
          ) : !small ? (
            <LoaderCircle size={32} aria-label="Cargando la foto" className="animate-spin text-suave" />
          ) : (
            <div className="relative inline-block select-none shadow-[0_1px_2px_rgb(0_0_0/0.12),0_12px_32px_rgb(0_0_0/0.18)]">
              <canvas
                ref={canvasRef}
                role="img"
                aria-label="Vista previa de la foto con los cambios"
                className="block max-h-[calc(100vh-8.5rem)] max-w-full"
              />
              <CropOverlay
                crop={edit.crop}
                ratio={ratioOf(edit.aspect)}
                rw={rw}
                rh={rh}
                onStart={remember}
                onChange={(crop) => setEdit((e) => ({ ...e, crop }))}
              />
            </div>
          )}
        </div>

        <aside className="w-80 shrink-0 space-y-5 overflow-y-auto border-l border-linea bg-panel p-4">
          <Group icon={RotateCw} title="Girar y voltear">
            <div className="grid grid-cols-2 gap-2">
              <ToolButton icon={RotateCcw} onClick={() => rotate(-90)}>
                Girar a la izquierda
              </ToolButton>
              <ToolButton icon={RotateCw} onClick={() => rotate(90)}>
                Girar a la derecha
              </ToolButton>
              <ToolButton icon={FlipHorizontal2} onClick={() => flip('flipH')}>
                Voltear horizontal
              </ToolButton>
              <ToolButton icon={FlipVertical2} onClick={() => flip('flipV')}>
                Voltear vertical
              </ToolButton>
            </div>
          </Group>

          <Group icon={Crop} title="Recortar">
            <p className="text-sm text-suave">Arrastra sobre la foto para recortar, o elige una proporción.</p>
            <div className="flex flex-wrap gap-1.5">
              {ASPECTS.map(([key, text]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={edit.aspect === key}
                  onClick={() => chooseAspect(key)}
                  className={`rounded-full border px-3 py-1 transition ${
                    edit.aspect === key
                      ? 'border-acento bg-acento font-bold text-sobre-acento'
                      : 'border-linea bg-elevado hover:border-acento'
                  }`}
                >
                  {text}
                </button>
              ))}
            </div>
            {edit.crop && (
              <button
                type="button"
                onClick={() => change({ crop: null, aspect: 'free' })}
                className="text-sm text-acento underline-offset-2 hover:underline"
              >
                Quitar el recorte
              </button>
            )}
          </Group>

          <Group icon={SlidersHorizontal} title="Ajustes">
            <Slider id="brillo" label="Brillo" value={edit.brightness} onStart={remember} onChange={(v) => setEdit((e) => ({ ...e, brightness: v }))} />
            <Slider id="contraste" label="Contraste" value={edit.contrast} onStart={remember} onChange={(v) => setEdit((e) => ({ ...e, contrast: v }))} />
            <Slider id="saturacion" label="Saturación" value={edit.saturation} onStart={remember} onChange={(v) => setEdit((e) => ({ ...e, saturation: v }))} />
          </Group>

          <Group icon={SlidersHorizontal} title="Filtros">
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map(([key, text]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={edit.filter === key}
                  onClick={() => change({ filter: key })}
                  className={`rounded-full border px-3 py-1 transition ${
                    edit.filter === key
                      ? 'border-acento bg-acento font-bold text-sobre-acento'
                      : 'border-linea bg-elevado hover:border-acento'
                  }`}
                >
                  {text}
                </button>
              ))}
            </div>
          </Group>

          <div className="space-y-1 border-t border-linea pt-4 text-sm text-suave">
            <p>
              Tamaño final: {outW.toLocaleString('es')} × {outH.toLocaleString('es')} px
            </p>
            <p>
              {primary === 'copy'
                ? 'Se guarda una copia al lado de la original, que no se toca.'
                : 'La original irá a la Papelera y esta ocupará su lugar.'}
            </p>
            <p>La foto editada no conserva los datos de la cámara (fecha, ubicación).</p>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default ImageEditor
