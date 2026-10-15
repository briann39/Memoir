import { useMemo, useRef, useState } from 'react'
import { CircleCheck, Images } from 'lucide-react'
import { api } from './api'
import { useDialogs } from './dialogs-context'
import { FILTER } from './keys'
import { isServerPath, peopleOf } from './library'
import { SHORTCUTS_DIALOG } from './shortcuts'
import RightPanel from './components/RightPanel'
import ImageEditor from './components/ImageEditor'
import SettingsDialog from './components/SettingsDialog'
import Sidebar from './components/Sidebar'
import Viewer from './components/Viewer'
import { useBatchOps } from './hooks/useBatchOps'
import { useBrowser } from './hooks/useBrowser'
import { useCollections } from './hooks/useCollections'
import { useEditing } from './hooks/useEditing'
import { useLibrary } from './hooks/useLibrary'
import { useLibraryActions } from './hooks/useLibraryActions'
import { useNotice } from './hooks/useNotice'
import { usePcFolders } from './hooks/usePcFolders'
import { usePeopleShortcuts } from './hooks/usePeopleShortcuts'
import { useServer } from './hooks/useServer'

// La app solo junta las piezas: cada hook se ocupa de una cosa (ver src/hooks)
function App() {
  const dialogs = useDialogs()
  const [notice, setNotice] = useNotice()
  const { library, setLibrary, ready, startup } = useLibrary()
  const pc = usePcFolders({ startup, settings: library.settings })
  const server = useServer({ library, setLibrary, libraryReady: ready, setNotice })
  const collections = useCollections(library)
  const browser = useBrowser(collections)
  const ops = useBatchOps({ library, setLibrary, server, browser, pc, dialogs, setNotice })

  const [detailsOpen, setDetailsOpen] = useState(() => window.innerWidth >= 1280) // en ventanas estrechas empieza oculto
  const [dragging, setDragging] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const inputRef = useRef(null)

  const { current, selected, persistent } = browser
  const actions = useLibraryActions(setLibrary, current?.id)
  const editor = useEditing({ library, current, browser, pc, server, setNotice })
  const modalOpen = settingsOpen || editor.editing // con una ventana encima, el teclado es suyo
  usePeopleShortcuts({
    enabled: persistent && !modalOpen,
    file: current?.id,
    numbered: collections.numbered,
    setLibrary,
  })

  // Las carpetas descartadas no se muestran, aunque la búsqueda las vuelva a encontrar
  const shownFolders = useMemo(
    () => pc.folders.filter((f) => !library.hiddenFolders.includes(f.path)),
    [pc.folders, library.hiddenFolders],
  )

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    browser.addFiles(e.dataTransfer.files)
  }

  return (
    <div
      className="flex h-screen bg-mesa text-tinta"
      onDragOver={(e) => {
        e.preventDefault()
        if (e.dataTransfer.types.includes('Files')) setDragging(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false)
      }}
      onDrop={onDrop}
    >
      <Sidebar
        pc={{
          folders: shownFolders,
          hiddenFolders: library.hiddenFolders,
          scanning: pc.scanning,
          canScan: Boolean(api),
          onStop: pc.stop,
          onRescan: () => {
            browser.reset()
            pc.rescan()
          },
          onAddFolder: pc.addFolder,
          onHide: (entry) => {
            actions.hideFolder(entry.path)
            browser.closeIfIn(entry.path)
          },
          onRestore: actions.restoreFolder,
        }}
        server={{ folders: server.folders, state: server.state, error: server.error, onRetry: server.retry }}
        people={{
          list: collections.people,
          filterIds: collections.filterIds,
          filterMode: collections.filterMode,
          entry: collections.filterEntry,
          onToggle: (tagId) => {
            collections.toggleFilter(tagId)
            browser.expand(FILTER)
          },
          onMode: collections.setFilterMode,
        }}
        collections={{
          loose: browser.loose.length,
          albums: collections.albumEntries,
          tags: collections.tagEntries,
        }}
        tree={{
          expanded: browser.expanded,
          filesByKey: browser.allFiles,
          selected,
          onToggle: browser.toggleFolder,
          onPick: browser.pick,
          onDropImage: actions.dropInAlbum,
        }}
        ops={{
          pendingCount: api ? ops.plan.length : 0,
          toDelete: ops.toDelete,
          sending: ops.sending,
          progress: ops.progress,
          onSendAll: ops.sendAll,
          onDeleteMarked: ops.deleteMarked,
          onClearMarks: ops.clearMarks,
          onCancel: ops.cancel,
        }}
        onOpenFiles={() => inputRef.current?.click()}
        onShowShortcuts={() => dialogs.alert(SHORTCUTS_DIALOG)}
        onShowSettings={() => setSettingsOpen(true)}
      />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          browser.addFiles(e.target.files)
          e.target.value = ''
        }}
      />

      <main className="relative min-w-0 flex-1">
        {current ? (
          <Viewer
            image={current}
            index={selected.index}
            total={browser.images.length}
            persistent={persistent}
            canMarkDelete={persistent && !isServerPath(library, current.id)}
            markedDelete={ops.toDelete.has(current.id)}
            onToggleDelete={() => ops.toggleDeleteMark(current.id)}
            who={persistent ? peopleOf(library, current.id) : []}
            sending={ops.sending}
            detailsOpen={detailsOpen}
            keysEnabled={!modalOpen}
            version={editor.versions[current.id]}
            onEdit={editor.start}
            onToggleDetails={() => setDetailsOpen((open) => !open)}
            onPrev={browser.prev}
            onNext={browser.next}
          />
        ) : (
          <EmptyState dragging={dragging} />
        )}
        {notice && (
          <p
            role="status"
            className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-md border border-linea bg-elevado px-4 py-2 shadow-lg"
          >
            <CircleCheck size={18} aria-hidden className="text-exito" />
            {notice}
          </p>
        )}
      </main>

      {detailsOpen && (
        <RightPanel
          image={current}
          canEdit={persistent}
          library={library}
          numbered={collections.numbered}
          actions={actions}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      {settingsOpen && (
        <SettingsDialog
          settings={library.settings}
          serverFolder={library.serverFolder}
          serverState={server.state}
          onChange={actions.setSetting}
          onServerFolder={actions.setServerFolder}
          onPickServerFolder={actions.pickServerFolder}
          onRescan={() => {
            browser.reset()
            pc.rescan()
          }}
          onReset={actions.resetSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {editor.editing && current && (
        <ImageEditor
          key={current.id}
          image={current}
          settings={library.settings}
          canReplace={editor.canReplace}
          onClose={editor.close}
          onSaved={editor.onSaved}
        />
      )}
    </div>
  )
}

// Lo que se ve cuando no hay ninguna foto abierta
function EmptyState({ dragging }) {
  return (
    <div className="grid h-full place-items-center p-8">
      <div
        className={`max-w-md rounded-lg border border-dashed p-10 text-center transition ${
          dragging ? 'border-acento bg-acento-suave' : 'border-linea'
        }`}
      >
        <Images size={40} aria-hidden strokeWidth={1.25} className="mx-auto text-suave" />
        <h2 className="mt-4 font-serif text-3xl leading-tight">
          {api ? 'Elige una foto para empezar' : 'Suelta tus fotos aquí'}
        </h2>
        <p className="mt-2 text-suave">
          {api
            ? 'Abre una carpeta o un álbum en la barra lateral, o arrastra fotos a esta ventana.'
            : 'También puedes usar «Abrir fotos».'}
        </p>
      </div>
    </div>
  )
}

export default App
