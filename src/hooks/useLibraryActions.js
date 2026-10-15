import { api } from '../api'
import {
  addAlbum,
  addTag,
  addToAlbum,
  hideFolder,
  removeAlbum,
  removeTag,
  resetSettings,
  restoreFolder,
  setSetting,
  setTagColor,
  toggleImageTag,
  toggleInAlbum,
} from '../library'

// Lo que el usuario puede hacer con su biblioteca. Las acciones sobre «la foto» usan la que se está viendo.
export function useLibraryActions(setLibrary, file) {
  const update = (fn) => setLibrary(fn)
  const serverFolder = (folder) => folder.trim().replace(/\//g, '\\')

  return {
    toggleTag: (tagId) => update((l) => toggleImageTag(l, file, tagId)),
    addTag: (name, kind) => update((l) => addTag(l, name, kind)),
    removeTag: (tagId) => update((l) => removeTag(l, tagId)),
    setColor: (tagId, color) => update((l) => setTagColor(l, tagId, color)),

    toggleAlbum: (albumId) => update((l) => toggleInAlbum(l, albumId, file)),
    addAlbum: (name) => update((l) => addAlbum(l, name)),
    removeAlbum: (albumId) => update((l) => removeAlbum(l, albumId)),
    dropInAlbum: (albumId, dropped) => update((l) => addToAlbum(l, albumId, dropped)),

    setSetting: (key, value) => update((l) => setSetting(l, key, value)),
    resetSettings: () => update(resetSettings),

    hideFolder: (folder) => update((l) => hideFolder(l, folder)),
    restoreFolder: (folder) => update((l) => restoreFolder(l, folder)),

    setServerFolder: (folder) => update((l) => ({ ...l, serverFolder: serverFolder(folder) })),
    pickServerFolder: async () => {
      const [folder] = await api.selectFolders()
      if (folder) update((l) => ({ ...l, serverFolder: serverFolder(folder) }))
    },
  }
}
