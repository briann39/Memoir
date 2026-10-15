import { useEffect } from 'react'
import { toggleImageTag } from '../library'

// Teclas 1 a 9: indican o quitan a la persona o mascota con ese número en la foto que se está viendo
export function usePeopleShortcuts({ enabled, file, numbered, setLibrary }) {
  useEffect(() => {
    if (!enabled) return
    const onKey = (e) => {
      if (!/^[1-9]$/.test(e.key) || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const entry = [...numbered].find(([, num]) => num === Number(e.key))
      if (entry) setLibrary((l) => toggleImageTag(l, file, entry[0]))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, file, numbered, setLibrary])
}
