import { useEffect, useState } from 'react'
import { EMPTY_LIBRARY, loadLibrary, saveLibrary } from '../library'

// La biblioteca del usuario (álbumes, etiquetas, personas, marcas…): se carga al iniciar y se guarda en cada cambio
export function useLibrary() {
  const [library, setLibrary] = useState(EMPTY_LIBRARY)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    loadLibrary().then((lib) => {
      setLibrary(lib)
      setReady(true)
    })
  }, [])

  useEffect(() => {
    if (ready) saveLibrary(library)
  }, [library, ready])

  return { library, setLibrary, ready }
}
