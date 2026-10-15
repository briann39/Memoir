const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolders: () => ipcRenderer.invoke('select-folders'),
  startScan: (roots) => ipcRenderer.invoke('scan-start', roots),
  stopScan: () => ipcRenderer.invoke('scan-stop'),
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
