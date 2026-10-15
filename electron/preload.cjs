const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolders: () => ipcRenderer.invoke('select-folders'),
  // channel: 'pc' (el equipo) o 'server' (la carpeta del servidor)
  startScan: (roots, channel) => ipcRenderer.invoke('scan-start', roots, channel),
  stopScan: (channel) => ipcRenderer.invoke('scan-stop', channel),
  loadLibrary: () => ipcRenderer.invoke('library-load'),
  saveLibrary: (library) => ipcRenderer.invoke('library-save', library),
  loadCatalog: (serverDir) => ipcRenderer.invoke('catalog-load', serverDir),
  saveCatalog: (serverDir, catalog) => ipcRenderer.invoke('catalog-save', serverDir, catalog),
  fileInfo: (file) => ipcRenderer.invoke('file-info', file),
  thumbnail: (file, size) => ipcRenderer.invoke('thumbnail', file, size),
  sendToServer: (file, serverDir, album, move) =>
    ipcRenderer.invoke('send-to-server', file, serverDir, album, move),
  trashFile: (file) => ipcRenderer.invoke('trash-file', file),
  readFolder: (folder) => ipcRenderer.invoke('read-folder', folder),
  onScanBatch: (cb) => {
    const handler = (_e, { channel, folders }) => cb(channel, folders)
    ipcRenderer.on('scan-batch', handler)
    return () => ipcRenderer.removeListener('scan-batch', handler)
  },
  onScanDone: (cb) => {
    const handler = (_e, { channel }) => cb(channel)
    ipcRenderer.on('scan-done', handler)
    return () => ipcRenderer.removeListener('scan-done', handler)
  },
})
