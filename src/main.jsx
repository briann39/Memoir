import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import DialogsProvider from './components/DialogsProvider.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DialogsProvider>
      <App />
    </DialogsProvider>
  </StrictMode>,
)
