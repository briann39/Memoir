// Los errores que vienen del proceso principal traen un prefijo técnico de Electron
export const cleanError = (err) =>
  err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
