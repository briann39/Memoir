const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolders: () => ipcRenderer.invoke('select-folders'),
  startScan: (roots) => ipcRenderer.invoke('scan-start', roots),
  stopScan: () => ipcRenderer.invoke('scan-stop'),
  loadLibrary: () => ipcRenderer.invoke('library-load'),
  saveLibrary: (library) => ipcRenderer.invoke('library-save', library),
  fileInfo: (file) => ipcRenderer.invoke('file-info', file),
  thumbnail: (file, size) => ipcRenderer.invoke('thumbnail', file, size),
  sendToServer: (file, serverDir, targets, move) =>
    ipcRenderer.invoke('send-to-server', file, serverDir, targets, move),
  trashFile: (file) => ipcRenderer.invoke('trash-file', file),
  readFolder: (folder) => ipcRenderer.invoke('read-folder', folder),
  onScanBatch: (cb) => {
    const handler = (_e, folders) => cb(folders)
    ipcRenderer.on('scan-batch', handler)
    return () => ipcRenderer.removeListener('scan-batch', handler)
  },
  onScanDone: (cb) => {
    const handler = () => cb()
    ipcRenderer.on('scan-done', handler)
    return () => ipcRenderer.removeListener('scan-done', handler)
  },
})
