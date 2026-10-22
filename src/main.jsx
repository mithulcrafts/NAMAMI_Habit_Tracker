import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Global state for install prompt
let installPrompt = null

const enableServiceWorker = () => {
  if ('serviceWorker' in navigator) {
    // In dev: unregister old SWs to prevent caching issues
    if (!import.meta.env.PROD) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((reg) => reg.unregister())
      })
    }
    // In prod: register new SW
    else {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/service-worker.js', { updateViaCache: 'none' })
          .then((registration) => {
            registration.update().catch(() => {})

            // Updates activate after open copies close; never force a reload
            // over a pending storage write or an unfinished form.
          })
          .catch((err) => console.error('SW registration failed', err))
      })
    }
  }
}

const enableInstallPrompt = () => {
  // Capture the install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    installPrompt = e
    window.__NAMAMI_INSTALL_READY = true
    console.log('Install prompt captured')
    // Dispatch custom event so React can listen
    window.dispatchEvent(new CustomEvent('installPromptReady', { detail: { prompt: e } }))
  })

  // Clear the prompt if app is installed
  window.addEventListener('appinstalled', () => {
    console.log('App was installed')
    installPrompt = null
    window.__NAMAMI_INSTALL_READY = false
  })
}

// Hide splash screen when app is hydrated
const removeSplash = () => {
  const splash = document.getElementById('splash')
  if (splash) {
    splash.style.opacity = '0'
    splash.style.transition = 'opacity 0.3s ease-out'
    setTimeout(() => splash.remove(), 300)
  }
}

// Expose for React to call
window._NAMAMI_HYDRATED = removeSplash

enableServiceWorker()
enableInstallPrompt()

// Make install prompt available globally
window.triggerInstall = async () => {
  if (installPrompt) {
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    console.log(`User response to install prompt: ${outcome}`)
    installPrompt = null
    window.__NAMAMI_INSTALL_READY = false
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
