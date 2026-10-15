// Arrastrar fotos (por su ruta) hacia los álbumes
export const DRAG_TYPE = 'application/x-memoir-image'

export function startImageDrag(e, file) {
  e.dataTransfer.setData(DRAG_TYPE, file)
  e.dataTransfer.effectAllowed = 'copy'
}

// Eventos para una zona que acepta fotos arrastradas; setOver marca si el cursor está encima
export function dropTarget(setOver, onDrop) {
  const accepts = (e) => e.dataTransfer.types.includes(DRAG_TYPE)
  return {
    onDragOver: (e) => {
      if (!accepts(e)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      setOver(true)
    },
    onDragLeave: (e) => {
      if (!e.currentTarget.contains(e.relatedTarget)) setOver(false)
    },
    onDrop: (e) => {
      if (!accepts(e)) return
      e.preventDefault()
      e.stopPropagation()
      setOver(false)
      onDrop(e.dataTransfer.getData(DRAG_TYPE))
    },
  }
}
