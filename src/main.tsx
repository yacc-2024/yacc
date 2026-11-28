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
import { initAccent } from './lib/accent'
import { initAppearance } from './lib/appearance'
import { hideSplash } from './lib/splash'

initGlassBlur()
initAccent()
initAppearance()

const root = ReactDOM.createRoot(document.getElementById('root')!)
root.render(
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

// 首屏画完再淡出开屏，避免看到半成品
requestAnimationFrame(() => {
  requestAnimationFrame(() => hideSplash())
})

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
