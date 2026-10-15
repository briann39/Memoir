import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Cloud, LoaderCircle, PanelRight, Trash2 } from 'lucide-react'
import { startImageDrag } from '../dnd'

const names = new Intl.ListFormat('es', { style: 'long', type: 'conjunction' })

// La copia: la foto sobre un paspartú, como en un álbum
const PRINT =
  'bg-marco p-3 shadow-[0_1px_2px_rgb(0_0_0/0.12),0_12px_32px_rgb(0_0_0/0.14)] rounded-[3px]'

function NavButton({ side, label, onClick }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`absolute top-1/2 z-10 -translate-y-1/2 rounded-full border border-linea bg-elevado p-2 text-tinta shadow transition hover:border-acento ${
        side === 'left' ? 'left-4' : 'right-4'
      }`}
    >
      <Icon size={22} aria-hidden />
    </button>
  )
}

// persistent: la foto es un archivo del disco (no una foto suelta)
function Viewer({
  image,
  index,
  total,
  persistent,
  canMarkDelete,
  markedDelete,
  sending,
  who,
  detailsOpen,
  onToggleDetails,
  onPrev,
  onNext,
  onToggleDelete,
}) {
  const api = window.electronAPI
  const needsCheck = persistent && Boolean(api)
  const [info, setInfo] = useState(null) // { id, exists, cloud }
  const [preview, setPreview] = useState(null) // { id, url } vista previa de una foto en la nube
  const [revealed, setRevealed] = useState(null) // foto en la nube que el usuario decidió descargar

  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'ArrowLeft') onPrev()
      if (e.key === 'ArrowRight') onNext()
      if (e.key === 'Delete' && canMarkDelete) onToggleDelete() // solo marca: no borra nada
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onPrev, onNext, onToggleDelete, canMarkDelete])

  // Antes de cargar la foto se mira si está solo en la nube: abrirla la descargaría
  useEffect(() => {
    if (!needsCheck) return
    let stale = false
    api.fileInfo(image.id).then((i) => {
      if (!stale) setInfo({ id: image.id, ...i })
    })
    return () => {
      stale = true
    }
  }, [api, image.id, needsCheck])

  const checked = !needsCheck || info?.id === image.id
  const missing = needsCheck && checked && !info.exists
  const cloudOnly = needsCheck && checked && info.exists && info.cloud && revealed !== image.id

  // Vista previa de las fotos en la nube, sin descargarlas
  useEffect(() => {
    if (!cloudOnly) return
    let stale = false
    api.thumbnail(image.id, 1024).then((url) => {
      if (!stale) setPreview({ id: image.id, url })
    })
    return () => {
      stale = true
    }
  }, [api, image.id, cloudOnly])

  const previewUrl = preview?.id === image.id ? preview.url : null
  const frame = markedDelete ? 'ring-2 ring-peligro' : ''
  const dim = markedDelete ? 'opacity-60' : ''

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-linea bg-panel px-4 py-2">
        <p className="min-w-0 flex-1 truncate font-bold" title={image.name}>
          {image.name}
        </p>
        <p className="shrink-0 text-suave" aria-label={`Foto ${index + 1} de ${total}`}>
          {index + 1} de {total}
        </p>
        {canMarkDelete && (
          <button
            type="button"
            title="Marcar para eliminar (Supr). No se borra hasta que lo confirmes."
            aria-pressed={markedDelete}
            disabled={sending}
            onClick={onToggleDelete}
            className={`flex shrink-0 items-center gap-2 rounded-md border px-3 py-1.5 transition disabled:opacity-50 ${
              markedDelete
                ? 'border-peligro bg-peligro font-bold text-sobre-acento'
                : 'border-linea hover:border-peligro hover:text-peligro'
            }`}
          >
            <Trash2 size={16} aria-hidden />
            {markedDelete ? 'Quitar marca' : 'Marcar para eliminar'}
          </button>
        )}
        <button
          type="button"
          title={detailsOpen ? 'Ocultar detalles' : 'Mostrar detalles'}
          aria-label={detailsOpen ? 'Ocultar detalles' : 'Mostrar detalles'}
          aria-pressed={detailsOpen}
          onClick={onToggleDetails}
          className={`shrink-0 rounded-md border p-1.5 transition ${
            detailsOpen ? 'border-acento bg-acento-suave text-acento' : 'border-linea hover:border-acento'
          }`}
        >
          <PanelRight size={18} aria-hidden />
        </button>
      </header>

      {markedDelete && (
        <p role="status" className="flex items-center justify-center gap-2 bg-peligro-suave px-4 py-1.5 text-peligro">
          <Trash2 size={15} aria-hidden />
          Marcada para eliminar. Se borrará cuando pulses «Eliminar» en la barra lateral.
        </p>
      )}

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-6">
        <figure className="flex max-w-full flex-col items-center gap-4">
          {!checked ? (
            <div className={`${PRINT} grid h-64 w-80 place-items-center text-suave`}>
              <LoaderCircle size={28} aria-label="Cargando la foto" className="animate-spin" />
            </div>
          ) : missing ? (
            <div className={`${PRINT} grid w-96 max-w-full place-items-center gap-1 px-8 py-16 text-center`}>
              <p className="font-serif text-xl">Esta foto ya no está en el disco</p>
              <p className="text-suave">Puede que la hayas movido o borrado desde otro programa.</p>
            </div>
          ) : cloudOnly ? (
            <>
              <div className={`${PRINT} ${frame}`}>
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={`Vista previa de ${image.name}`}
                    className={`block max-h-[calc(100vh-17rem)] max-w-full object-contain ${dim}`}
                  />
                ) : (
                  <div className="grid h-64 w-80 place-items-center text-suave">
                    <Cloud size={56} aria-hidden strokeWidth={1.25} />
                  </div>
                )}
              </div>
              <figcaption className="flex flex-wrap items-center justify-center gap-3 text-center">
                <span className="flex items-center gap-2 text-suave">
                  <Cloud size={16} aria-hidden />
                  {previewUrl ? 'Vista previa.' : 'Sin vista previa.'} La foto completa solo está en la nube.
                </span>
                <button
                  type="button"
                  onClick={() => setRevealed(image.id)}
                  className="rounded-md bg-acento px-3 py-1.5 font-bold text-sobre-acento transition hover:opacity-90"
                >
                  Descargar y ver completa
                </button>
              </figcaption>
            </>
          ) : (
            <>
              <div className={`${PRINT} ${frame}`}>
                <img
                  key={image.id}
                  src={image.url}
                  alt={who.length ? `${image.name}: ${names.format(who.map((w) => w.name))}` : image.name}
                  draggable={persistent}
                  onDragStart={(e) => startImageDrag(e, image.id)}
                  className={`block max-h-[calc(100vh-17rem)] max-w-full object-contain ${dim}`}
                />
              </div>
              <figcaption className="text-center">
                {who.length > 0 ? (
                  <p className="font-serif text-2xl leading-tight">{names.format(who.map((w) => w.name))}</p>
                ) : (
                  <p className="font-serif text-xl italic text-suave">
                    {persistent ? 'Nadie indicado todavía' : image.name}
                  </p>
                )}
              </figcaption>
            </>
          )}
        </figure>

        {total > 1 && (
          <>
            <NavButton side="left" label="Foto anterior (flecha izquierda)" onClick={onPrev} />
            <NavButton side="right" label="Foto siguiente (flecha derecha)" onClick={onNext} />
          </>
        )}
      </div>
    </div>
  )
}

export default Viewer
