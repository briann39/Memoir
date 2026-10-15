import { useState } from 'react'
import { dropTarget } from '../dnd'
import { kindOf, TAG_COLORS } from '../library'

function NewItemForm({ placeholder, onAdd }) {
  const [value, setValue] = useState('')

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (!value.trim()) return
        onAdd(value)
        setValue('')
      }}
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm outline-none focus:border-sky-400"
      />
      <button
        type="submit"
        aria-label="Crear"
        className="rounded-lg bg-slate-700 px-3 text-lg transition hover:bg-slate-600"
      >
        +
      </button>
    </form>
  )
}

// Una lista de etiquetas de un tipo (personas, mascotas o etiquetas normales) que se activan en la foto actual
function TagSection({ title, hint, empty, placeholder, tags, activeIds, canEdit, onToggle, onAdd, onRemove }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
        {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.length === 0 && <p className="text-sm text-slate-500">{empty}</p>}
        {tags.map((tag) => {
          const color = TAG_COLORS[tag.color % TAG_COLORS.length]
          const on = activeIds.includes(tag.id)
          return (
            <span
              key={tag.id}
              className={`group flex items-center rounded-full text-sm ${on ? color.active : color.chip}`}
            >
              <button
                type="button"
                disabled={!canEdit}
                aria-pressed={on}
                onClick={() => onToggle(tag.id)}
                className="rounded-full py-1 pl-3 pr-2 disabled:cursor-default"
              >
                {tag.name}
              </button>
              <button
                type="button"
                aria-label={`Eliminar ${tag.name}`}
                onClick={() => {
                  if (window.confirm(`¿Eliminar "${tag.name}" de todas las fotos?`)) onRemove(tag.id)
                }}
                className="pr-2 text-xs opacity-0 transition group-hover:opacity-70 hover:!opacity-100"
              >
                ✕
              </button>
            </span>
          )
        })}
      </div>
      <NewItemForm placeholder={placeholder} onAdd={onAdd} />
    </section>
  )
}

function RightPanel({
  image,
  canEdit,
  library,
  onServerFolder,
  onPickServerFolder,
  onToggleTag,
  onAddTag,
  onRemoveTag,
  onToggleAlbum,
  onAddAlbum,
  onRemoveAlbum,
  onDropImage,
}) {
  const [dropId, setDropId] = useState(null) // álbum sobre el que está el cursor al arrastrar
  const activeIds = (canEdit && library.imageTags[image.id]) || []
  const byKind = (kind) => library.tags.filter((t) => kindOf(t) === kind)

  const shared = { activeIds, canEdit, onToggle: onToggleTag, onRemove: onRemoveTag }

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-6 overflow-y-auto border-l border-slate-800 bg-slate-950 p-4">
      <div className="min-w-0">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Foto</h2>
        <p className="mt-1 truncate text-sm">
          {image ? image.name : 'Elige una foto para indicar quién sale en ella'}
        </p>
        {image && !canEdit && (
          <p className="mt-1 text-xs text-amber-400">
            Las imágenes sueltas no se pueden etiquetar. Abre su carpeta desde la barra lateral.
          </p>
        )}
      </div>

      <TagSection
        {...shared}
        title="👤 Personas"
        hint="Quién sale en la foto. Es solo un dato para buscar, por ejemplo las fotos donde salen dos personas."
        empty="Crea a las personas, por ejemplo Mamá o Brian."
        placeholder="Nueva persona"
        tags={byKind('persona')}
        onAdd={(name) => onAddTag(name, 'persona')}
      />

      <TagSection
        {...shared}
        title="🐾 Mascotas"
        hint="Igual que las personas: un dato de la foto, no una carpeta."
        empty="Crea a tus mascotas, por ejemplo Luna."
        placeholder="Nueva mascota"
        tags={byKind('mascota')}
        onAdd={(name) => onAddTag(name, 'mascota')}
      />

      <TagSection
        {...shared}
        title="Etiquetas"
        hint="Para organizar: Juegos, Trabajo…"
        empty="Crea etiquetas como Juegos o Trabajo."
        placeholder="Nueva etiqueta"
        tags={byKind('tag')}
        onAdd={(name) => onAddTag(name, 'tag')}
      />

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Álbumes</h2>
        <ul className="space-y-1">
          {library.albums.length === 0 && (
            <li className="text-sm text-slate-500">Crea álbumes para agrupar tus fotos.</li>
          )}
          {library.albums.map((album) => (
            <li
              key={album.id}
              className={`group flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-800 ${
                dropId === album.id ? 'bg-sky-500/20 ring-1 ring-sky-400' : ''
              }`}
              {...dropTarget(
                (over) => setDropId(over ? album.id : null),
                (file) => onDropImage(album.id, file),
              )}
            >
              <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  checked={canEdit && album.images.includes(image.id)}
                  onChange={() => onToggleAlbum(album.id)}
                  className="accent-sky-500"
                />
                <span className="min-w-0 flex-1 truncate">{album.name}</span>
                <span className="text-xs text-slate-500">{album.images.length}</span>
              </label>
              <button
                type="button"
                aria-label={`Eliminar álbum ${album.name}`}
                onClick={() => {
                  if (window.confirm(`¿Eliminar el álbum "${album.name}"? Las fotos no se borran.`)) {
                    onRemoveAlbum(album.id)
                  }
                }}
                className="text-xs text-slate-500 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <NewItemForm placeholder="Nuevo álbum" onAdd={onAddAlbum} />
      </section>

      {window.electronAPI && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Servidor</h2>
          <input
            key={library.serverFolder}
            defaultValue={library.serverFolder}
            onBlur={(e) => onServerFolder(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            placeholder="\\servidor\fotos"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm outline-none focus:border-sky-400"
          />
          <button
            type="button"
            onClick={onPickServerFolder}
            className="w-full rounded-lg bg-slate-700 px-3 py-1.5 text-sm transition hover:bg-slate-600"
          >
            Elegir carpeta…
          </button>
          <p className="text-xs text-slate-500">
            Carpeta de red o unidad donde se guardan tus álbumes. Los datos de las fotos (personas,
            mascotas y etiquetas) se guardan ahí mismo, en una carpeta oculta llamada .memoir. Al
            pulsar "Enviar", cada foto va a la carpeta con el nombre de su álbum de la app.
          </p>
        </section>
      )}
    </aside>
  )
}

export default RightPanel
