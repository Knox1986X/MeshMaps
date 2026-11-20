import { createRoot } from 'react-dom/client'
import 'maplibre-gl/dist/maplibre-gl.css'
import '@/styles/index.css'
import App from '@/App'
import { ErrorBoundary } from '@/components/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline mode is optional */
    })
  })
}
