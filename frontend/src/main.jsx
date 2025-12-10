import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Suppress Chrome extension message channel errors
// These are caused by browser extensions, not our application code
window.addEventListener('error', (event) => {
  if (event.message && event.message.includes('message channel closed')) {
    event.preventDefault()
    console.debug('Suppressed Chrome extension message channel error:', event.message)
  }
})

// Suppress unhandled promise rejections from Chrome extensions
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.message && event.reason.message.includes('message channel closed')) {
    event.preventDefault()
    console.debug('Suppressed Chrome extension promise rejection:', event.reason.message)
  }
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
