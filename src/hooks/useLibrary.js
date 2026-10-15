import { useEffect, useState } from 'react'
import { api } from '../api'
import { EMPTY_LIBRARY, loadLibrary, saveLibrary } from '../library'

// La biblioteca del usuario (álbumes, etiquetas, ajustes, marcas…): se carga al iniciar y se guarda en cada cambio.
// startup son los ajustes tal como estaban al abrir la app: la primera búsqueda de fotos los usa.
export function useLibrary() {
  const [library, setLibrary] = useState(EMPTY_LIBRARY)
  const [ready, setReady] = useState(false)
  const [startup, setStartup] = useState(null)

  useEffect(() => {
    loadLibrary().then(async (lib) => {
      await api?.applySettings(lib.settings) // antes de cualquier búsqueda: tema y tamaño mínimo
      setLibrary(lib)
      setStartup(lib.settings)
      setReady(true)
    })
  }, [])

  useEffect(() => {
    if (ready) saveLibrary(library)
  }, [library, ready])

  // Cambios posteriores de tema o de tamaño mínimo
  const { theme, minKb } = library.settings
  useEffect(() => {
    if (ready) api?.applySettings({ theme, minKb })
  }, [ready, theme, minKb])

  return { library, setLibrary, ready, startup }
}
