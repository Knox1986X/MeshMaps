import { createRoot } from 'react-dom/client'
import 'maplibre-gl/dist/maplibre-gl.css'
import '@/styles/index.css'
import App from '@/App'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { isNativeShell } from '@/utils/nativeSave'
import { installOfflineProtocol } from '@/offline/protocol'

// has to run before the first MapLibre instance is created
installOfflineProtocol()

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
)

// The service worker is only useful for the PWA. Inside the Android shell it would keep
// serving the *previous* bundle after an APK update, so it is skipped there.
if ('serviceWorker' in navigator && import.meta.env.PROD && !isNativeShell()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline mode is optional */
    })
  })
}
