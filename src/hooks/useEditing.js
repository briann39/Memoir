import { useState } from 'react'
import { isServerPath } from '../library'

const dirOf = (file) => file.replace(/[\\/][^\\/]*$/, '')
const nameOf = (file) => file.split(/[\\/]/).pop()

// Editar la foto que se está viendo: si el editor está abierto y qué hacer cuando se guarda
export function useEditing({ library, current, browser, pc, server, setNotice }) {
  const [editing, setEditing] = useState(false)
  const [versions, setVersions] = useState({}) // foto -> cuándo se reemplazó (para no mostrar la versión en caché)

  // En una carpeta de red no hay Papelera, así que allí solo se guardan copias
  const canReplace = Boolean(current) && !isServerPath(library, current.id)

  const onSaved = async ({ path, mode }) => {
    setEditing(false)
    if (mode === 'replace') {
      setVersions((v) => ({ ...v, [path]: Date.now() }))
      setNotice('Foto reemplazada. La original está en la Papelera.')
      return
    }

    setNotice(`Copia guardada: ${nameOf(path)}.`)
    const dir = dirOf(path)
    if (isServerPath(library, path)) server.refresh()
    else pc.addCount(dir)
    const fotos = await browser.reloadFolder(dir)
    // Si se está mirando esa carpeta, se pasa a ver la copia
    if (browser.selected?.key === dir) {
      const index = fotos.findIndex((f) => f.id === path)
      if (index >= 0) browser.pick(dir, index)
    }
  }

  return {
    editing,
    canReplace,
    versions,
    start: () => setEditing(true),
    close: () => setEditing(false),
    onSaved,
  }
}
