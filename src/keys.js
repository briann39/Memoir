// Claves de las entradas de la barra lateral que no son carpetas del disco
export const LOOSE = '__loose__' // fotos abiertas con «Abrir fotos» o arrastradas a la ventana
export const FILTER = '__filter__' // resultado de «Buscar por personas»

// Tipos de entrada cuyo contenido sale de la biblioteca y no se lee del disco
export const VIRTUAL = new Set(['album', 'persona', 'mascota', 'tag', 'filter', 'loose'])
