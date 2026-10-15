import { useMemo, useRef, useState } from 'react'
import { api } from '../api'
import { cleanError } from '../errors'
import { clearDeleteMarks, forgetImage, isServerPath, moveMeta, sendPlan, toggleDelete } from '../library'

const plural = (count, one, many) => `${count.toLocaleString('es')} ${count === 1 ? one : many}`
const folderOf = (file) => file.replace(/[\\/][^\\/]*$/, '')

// Las dos operaciones que mueven muchas fotos: enviarlas al servidor y eliminarlas.
// Ambas avanzan foto por foto, muestran su progreso y se pueden cancelar.
export function useBatchOps({ library, setLibrary, server, browser, pc, dialogs, setNotice }) {
  const [sending, setSending] = useState(false) // hay un envío o un borrado en curso
  const [progress, setProgress] = useState(null) // { label, done, total }
  const cancelRef = useRef(false)

  const toDelete = useMemo(() => new Set(library.toDelete), [library.toDelete])
  // Fotos de este equipo que están en un álbum de la app o tienen persona o mascota
  const plan = useMemo(() => sendPlan(library), [library])

  // Quita fotos que ya no están en el disco de todas las listas, álbumes y etiquetas
  const removeFiles = (files) => {
    browser.dropFiles(files)
    pc.removeCounts(files)
    setLibrary((l) => files.reduce((lib, file) => forgetImage(lib, file), l))
  }

  // Corre una operación sobre cada elemento, con progreso y cancelación. Devuelve qué pasó con cada uno.
  async function run(label, items, step) {
    cancelRef.current = false
    setSending(true)
    setProgress({ label, done: 0, total: items.length })
    const done = []
    let failure = null
    for (const item of items) {
      if (cancelRef.current) break
      try {
        await step(item, done)
      } catch (err) {
        failure = cleanError(err)
        break
      }
      setProgress({ label, done: done.length, total: items.length })
    }
    setSending(false)
    setProgress(null)
    return { done, failure, cancelled: cancelRef.current }
  }

  // Marcar es el primer paso de eliminar: no se borra nada todavía
  const toggleDeleteMark = (file) => {
    if (file && !isServerPath(library, file)) setLibrary((l) => toggleDelete(l, file))
  }

  const clearMarks = () => setLibrary(clearDeleteMarks)

  // Manda las fotos marcadas a la Papelera. Si están en una carpeta de iCloud, también se eliminan de allí.
  const deleteMarked = async () => {
    if (sending || !library.toDelete.length) return
    const files = [...library.toDelete]
    const ok = await dialogs.confirm({
      title: files.length === 1 ? '¿Eliminar la foto marcada?' : `¿Eliminar las ${files.length.toLocaleString('es')} fotos marcadas?`,
      body: 'Irán a la Papelera de reciclaje. Si están en una carpeta de iCloud, también se eliminarán de iCloud.',
      confirmLabel: 'Eliminar',
      tone: 'danger',
    })
    if (!ok) return

    const { done, failure, cancelled } = await run('Eliminando', files, async (file, done) => {
      if ((await api.fileInfo(file)).exists) await api.trashFile(file)
      done.push(file) // si ya no existía, solo se quita de las listas
    })
    if (done.length) removeFiles(done)

    if (failure) {
      dialogs.alert({
        title: 'No se pudo terminar',
        body: `Se eliminaron ${done.length.toLocaleString('es')} de ${files.length.toLocaleString('es')} fotos.\n\n${failure}\n\nLas demás siguen marcadas: puedes volver a intentarlo.`,
      })
    } else if (cancelled) {
      setNotice(`Cancelado. Se eliminaron ${plural(done.length, 'foto', 'fotos')}.`)
    } else {
      setNotice(`${plural(done.length, 'foto eliminada', 'fotos eliminadas')}.`)
    }
  }

  // Envía las fotos del plan al servidor, cada una a la carpeta con el nombre de su álbum
  const sendAll = async () => {
    if (sending || !plan.length) return
    if (!server.root) {
      dialogs.alert({
        title: 'Falta la carpeta del servidor',
        body: 'Elígela en el panel de detalles, en la sección «Servidor».',
      })
      return
    }
    if (!server.connected()) {
      dialogs.alert({
        title: 'No hay conexión con el servidor',
        body: 'Comprueba que esté encendido y vuelve a intentarlo.',
      })
      return
    }
    const porAlbum = new Map()
    for (const { album } of plan) porAlbum.set(album, (porAlbum.get(album) ?? 0) + 1)
    const ok = await dialogs.confirm({
      title: `¿Enviar ${plural(plan.length, 'foto', 'fotos')} al servidor?`,
      body: 'Cada foto va al álbum donde la pusiste. Sus datos (personas, mascotas y etiquetas) viajan con ella.',
      items: [...porAlbum].map(([label, count]) => ({ label, value: count.toLocaleString('es') })),
      note: 'Las originales irán a la Papelera. Si están en una carpeta de iCloud, también se eliminarán de iCloud.',
      confirmLabel: 'Enviar',
    })
    if (!ok) return

    const sent = []
    const missing = []
    const { failure, cancelled } = await run('Enviando', plan, async ({ file, album }, done) => {
      try {
        sent.push({ from: file, to: await api.sendToServer(file, server.root, album, true) })
      } catch (err) {
        if (!err.message.includes('SOURCE_MISSING')) throw err
        missing.push(file) // ya no existe en el disco
      }
      done.push(file)
    })

    if (sent.length) {
      setLibrary((l) => moveMeta(l, sent)) // los datos pasan a la ruta nueva, en el servidor
      browser.invalidate(new Set(sent.map(({ to }) => folderOf(to))))
      server.refresh()
    }
    if (sent.length || missing.length) removeFiles([...sent.map(({ from }) => from), ...missing])

    const extra = missing.length ? ` ${plural(missing.length, 'ya no existía', 'ya no existían')}.` : ''
    if (failure) {
      dialogs.alert({
        title: 'No se pudo terminar',
        body: `Se enviaron ${sent.length.toLocaleString('es')} de ${plan.length.toLocaleString('es')} fotos.${extra}\n\n${failure}\n\nLas que faltan siguen en su álbum de la app: puedes volver a enviar.`,
      })
    } else if (cancelled) {
      setNotice(`Cancelado. Se enviaron ${plural(sent.length, 'foto', 'fotos')}.${extra}`)
    } else {
      setNotice(`${plural(sent.length, 'foto enviada', 'fotos enviadas')} al servidor.${extra}`)
    }
  }

  // Detiene la operación después de la foto que se está procesando
  const cancel = () => {
    cancelRef.current = true
    setProgress((p) => p && { ...p, label: 'Cancelando después de la foto actual:' })
  }

  return {
    plan,
    toDelete,
    sending,
    progress,
    toggleDeleteMark,
    clearMarks,
    deleteMarked,
    sendAll,
    cancel,
  }
}
