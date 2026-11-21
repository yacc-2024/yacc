import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { AppProvider } from './state/AppContext'
import { ConfirmProvider } from './components/ui'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import { initGlassBlur } from './lib/glass'
import { initAppearance } from './lib/appearance'

initGlassBlur()
initAppearance()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProvider>
        <ConfirmProvider>
          <App />
        </ConfirmProvider>
      </AppProvider>
    </BrowserRouter>
  </React.StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
