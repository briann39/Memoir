# Memoir

Visor y organizador de fotos para Windows. Reúne las fotos de tu PC (y de tu servidor casero) en un solo lugar, con álbumes, personas, etiquetas y un editor sencillo. Hecho con Electron, React y Tailwind.

> Versión 0.x: en desarrollo. La versión estable será la 1.0.0.

## Qué hace

- **Todas tus fotos por carpeta.** Busca las imágenes de la PC y las muestra en una barra lateral; el visor ocupa el resto de la ventana.
- **Álbumes, etiquetas y personas/mascotas.** Se guardan como datos, no como carpetas. Puedes filtrar por varias personas a la vez (todas o cualquiera). Los números 1–9 asignan personas rápido.
- **Arrastrar fotos a un álbum** desde la barra lateral.
- **Fotos de iCloud sin descargarlas.** Las que están solo en la nube se marcan con ☁ y se previsualizan sin ocupar espacio.
- **Eliminar en dos pasos.** Marcas varias fotos y las mandas a la Papelera todas juntas.
- **Enviar al servidor.** Copia las fotos de tus álbumes o con personas a una carpeta de red (Samba/Proxmox), verifica el tamaño y manda el original a la Papelera. Los datos viajan en `.memoir\catalogo.json`, así que al volver a verlas conservan sus personas y etiquetas.
- **Editor.** Girar, voltear, recortar (libre o con proporciones), brillo, contraste, saturación y filtros, con deshacer/rehacer. Por defecto guarda una copia «(editada)» y no toca la original. JPG, PNG y WebP.
- **Configuración.** Tema (automático, claro, oscuro), carpetas a buscar, tamaño mínimo, calidad de JPG/WebP, modo de guardado y carpeta del servidor.

## Requisitos

- Windows 10/11
- Node.js 20 o superior

## Uso

```bash
npm install
npm run electron:start   # compila y abre la app
npm run electron:dev     # modo desarrollo con recarga
npm run lint
```

Si lanzas Electron desde una terminal con `ELECTRON_RUN_AS_NODE` definida, usa estos scripts: `electron/run.js` la quita antes de abrir la app.

## Tus datos

Los álbumes, etiquetas y ajustes se guardan en `library.json` dentro de la carpeta de datos de la app (Configuración → Datos → «Abrir carpeta de datos», útil para copias de seguridad). Las fotos nunca se modifican salvo que lo pidas: enviar al servidor y eliminar usan la Papelera de Windows.

## Estructura

| Carpeta | Contenido |
| --- | --- |
| `electron/` | Proceso principal: ventana, búsqueda de fotos, servidor, guardado de imágenes |
| `src/components/` | Interfaz (barra lateral, visor, panel derecho, editor, configuración) |
| `src/hooks/` | Lógica de la app, un hook por tema |
| `src/library.js` | Modelo de datos: álbumes, etiquetas, ajustes, catálogo del servidor |
| `src/editor.js` | Operaciones del editor sobre canvas |
| `build/`, `scripts/` | Icono de la app y su generador |

## Pendiente

Instalador `.exe`, miniaturas en cuadrícula, soporte HEIC.
