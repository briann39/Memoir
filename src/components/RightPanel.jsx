import { useState } from 'react'
import { FolderOpen, PawPrint, Plus, Tag, User, X } from 'lucide-react'
import { useDialogs } from '../dialogs-context'
import { dropTarget } from '../dnd'
import { kindOf } from '../library'

// Cada tipo tiene su color: personas en el azul de la app, mascotas en ocre, etiquetas neutras
const KINDS = {
  persona: {
    icon: User,
    on: 'border-acento bg-acento text-sobre-acento',
    off: 'border-linea bg-elevado hover:border-acento',
  },
  mascota: {
    icon: PawPrint,
    on: 'border-mascota bg-mascota text-sobre-acento',
    off: 'border-linea bg-elevado hover:border-mascota',
  },
  tag: {
    icon: Tag,
    on: 'border-tinta bg-tinta text-panel',
    off: 'border-linea bg-elevado hover:border-tinta',
  },
}

// Campo para crear algo nuevo. check() devuelve el motivo si el nombre no sirve, y se muestra aquí mismo.
function NewItemForm({ label, placeholder, check, onAdd }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(null)

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        const name = value.trim()
        if (!name) return
        const problem = check?.(name)
        if (problem) {
          setError(problem)
          return
        }
        onAdd(name)
        setValue('')
        setError(null)
      }}
    >
      <div className="flex gap-2">
        <input
          value={value}
          aria-label={label}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${label}-error` : undefined}
          onChange={(e) => {
            setValue(e.target.value)
            setError(null)
          }}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-md border border-linea bg-elevado px-3 py-1.5 placeholder:text-suave"
        />
        <button
          type="submit"
          aria-label={`Crear: ${label}`}
          title="Crear"
          className="rounded-md border border-linea bg-elevado p-2 transition hover:border-acento"
        >
          <Plus size={16} aria-hidden />
        </button>
      </div>
      {error && (
        <p id={`${label}-error`} role="alert" className="mt-1 text-sm text-peligro">
          {error}
        </p>
      )}
    </form>
  )
}

function Section({ icon: Icon, title, hint, children }) {
  return (
    <section className="space-y-3 border-t border-linea pt-5">
      <div>
        <h3 className="flex items-center gap-2 font-bold">
          {Icon && <Icon size={16} aria-hidden className="text-suave" />}
          {title}
        </h3>
        {hint && <p className="mt-1 text-sm text-suave">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

// Las etiquetas de un tipo (personas, mascotas o etiquetas) que se activan en la foto actual
function TagSection({ kind, title, hint, empty, label, placeholder, tags, numbered, activeIds, canEdit, ...actions }) {
  const { confirm } = useDialogs()
  const { icon: Icon, on, off } = KINDS[kind]

  const remove = async (tag) => {
    const ok = await confirm({
      title: `¿Eliminar «${tag.name}»?`,
      body: 'Se quitará de todas las fotos. Las fotos no se borran.',
      confirmLabel: 'Eliminar',
      tone: 'danger',
    })
    if (ok) actions.onRemove(tag.id)
  }

  return (
    <Section icon={Icon} title={title} hint={hint}>
      <div className="flex flex-wrap gap-2">
        {tags.length === 0 && <p className="text-suave">{empty}</p>}
        {tags.map((tag) => {
          const active = activeIds.includes(tag.id)
          const key = numbered?.get(tag.id)
          return (
            <span
              key={tag.id}
              className={`group flex items-center rounded-full border transition ${active ? on : off} ${
                canEdit ? '' : 'opacity-70'
              }`}
            >
              <button
                type="button"
                disabled={!canEdit}
                aria-pressed={active}
                title={key ? `Atajo: tecla ${key}` : undefined}
                onClick={() => actions.onToggle(tag.id)}
                className="flex items-center gap-1.5 rounded-full py-1 pl-3 pr-2 disabled:cursor-default"
              >
                {tag.name}
                {key && (
                  <kbd
                    aria-hidden
                    className={`rounded px-1 text-xs ${active ? 'bg-black/20' : 'bg-linea/60 text-suave'}`}
                  >
                    {key}
                  </kbd>
                )}
              </button>
              <button
                type="button"
                aria-label={`Eliminar ${tag.name}`}
                onClick={() => remove(tag)}
                className="mr-1.5 rounded-full p-0.5 opacity-0 transition hover:bg-black/15 focus:opacity-100 group-hover:opacity-100"
              >
                <X size={13} aria-hidden />
              </button>
            </span>
          )
        })}
      </div>
      <NewItemForm
        label={label}
        placeholder={placeholder}
        check={(name) =>
          tags.some((t) => t.name.toLowerCase() === name.toLowerCase()) ? 'Ya existe uno con ese nombre.' : null
        }
        onAdd={actions.onAdd}
      />
    </Section>
  )
}

function RightPanel({
  image,
  canEdit,
  library,
  numbered,
  onServerFolder,
  onPickServerFolder,
  onToggleTag,
  onAddTag,
  onRemoveTag,
  onToggleAlbum,
  onAddAlbum,
  onRemoveAlbum,
  onDropImage,
  albumCheck,
}) {
  const { confirm } = useDialogs()
  const [dropId, setDropId] = useState(null) // álbum sobre el que está el cursor al arrastrar
  const activeIds = (canEdit && library.imageTags[image.id]) || []
  const byKind = (kind) => library.tags.filter((t) => kindOf(t) === kind)
  const shared = { activeIds, canEdit, numbered, onToggle: onToggleTag, onRemove: onRemoveTag }

  const removeAlbum = async (album) => {
    const ok = await confirm({
      title: `¿Eliminar el álbum «${album.name}»?`,
      body: 'Solo se quita el álbum de la app. Las fotos no se borran.',
      confirmLabel: 'Eliminar álbum',
      tone: 'danger',
    })
    if (ok) onRemoveAlbum(album.id)
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col gap-5 overflow-y-auto border-l border-linea bg-panel p-4">
      <header>
        <h2 className="font-serif text-2xl leading-tight">Detalles</h2>
        <p className="mt-1 truncate text-suave" title={image?.name}>
          {image ? image.name : 'Elige una foto para indicar quién sale en ella.'}
        </p>
        {image && !canEdit && (
          <p className="mt-2 rounded-md bg-mascota-suave p-2 text-sm text-mascota">
            Las fotos sueltas no se pueden etiquetar. Abre su carpeta desde la barra lateral.
          </p>
        )}
      </header>

      <TagSection
        {...shared}
        kind="persona"
        title="Personas"
        hint="Quién sale en la foto. Sirve para buscar."
        empty="Todavía no hay personas. Crea la primera."
        label="Nueva persona"
        placeholder="Nombre de la persona"
        tags={byKind('persona')}
        onAdd={(name) => onAddTag(name, 'persona')}
      />

      <TagSection
        {...shared}
        kind="mascota"
        title="Mascotas"
        hint="Igual que las personas."
        empty="Todavía no hay mascotas."
        label="Nueva mascota"
        placeholder="Nombre de la mascota"
        tags={byKind('mascota')}
        onAdd={(name) => onAddTag(name, 'mascota')}
      />

      <TagSection
        {...shared}
        kind="tag"
        title="Etiquetas"
        hint="Para organizar, como «Viaje» o «Trabajo»."
        empty="Todavía no hay etiquetas."
        label="Nueva etiqueta"
        placeholder="Nombre de la etiqueta"
        tags={byKind('tag')}
        numbered={null}
        onAdd={(name) => onAddTag(name, 'tag')}
      />

      <Section icon={FolderOpen} title="Álbumes" hint="Cada álbum será una carpeta en el servidor.">
        <ul className="space-y-1">
          {library.albums.length === 0 && <li className="text-suave">Todavía no hay álbumes.</li>}
          {library.albums.map((album) => (
            <li
              key={album.id}
              className={`group flex items-center gap-2 rounded-md px-2 py-1 transition ${
                dropId === album.id ? 'bg-acento-suave ring-2 ring-acento' : 'hover:bg-linea/40'
              }`}
              {...dropTarget(
                (over) => setDropId(over ? album.id : null),
                (file) => onDropImage(album.id, file),
              )}
            >
              <label className="flex min-w-0 flex-1 items-center gap-2">
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  checked={canEdit && album.images.includes(image.id)}
                  onChange={() => onToggleAlbum(album.id)}
                  className="size-4 accent-acento"
                />
                <span className="min-w-0 flex-1 truncate">{album.name}</span>
                <span className="text-sm text-suave">{album.images.length}</span>
              </label>
              <button
                type="button"
                aria-label={`Eliminar el álbum ${album.name}`}
                onClick={() => removeAlbum(album)}
                className="rounded p-0.5 text-suave opacity-0 transition hover:text-peligro focus:opacity-100 group-hover:opacity-100"
              >
                <X size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <NewItemForm label="Nuevo álbum" placeholder="Nombre del álbum" check={albumCheck} onAdd={onAddAlbum} />
      </Section>

      {window.electronAPI && (
        <Section title="Servidor" hint="Carpeta de red o unidad donde se guardan tus álbumes y los datos de las fotos.">
          <input
            key={library.serverFolder}
            aria-label="Carpeta del servidor"
            defaultValue={library.serverFolder}
            onBlur={(e) => onServerFolder(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            placeholder="\\servidor\fotos"
            className="w-full rounded-md border border-linea bg-elevado px-3 py-1.5 placeholder:text-suave"
          />
          <button
            type="button"
            onClick={onPickServerFolder}
            className="w-full rounded-md border border-linea bg-elevado px-3 py-1.5 transition hover:border-acento"
          >
            Elegir carpeta
          </button>
        </Section>
      )}
    </aside>
  )
}

export default RightPanel
