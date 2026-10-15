import { createContext, useContext } from 'react'

// confirm({ title, body, items, confirmLabel, cancelLabel, tone }) -> Promise<boolean>
// alert({ title, body, items, confirmLabel }) -> Promise<void>
export const DialogsContext = createContext(null)

export const useDialogs = () => useContext(DialogsContext)
