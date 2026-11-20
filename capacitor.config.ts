import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Android/iOS shell around the same web app.
 * Build steps: `npm run android:sync` → open `android/` in Android Studio,
 * or use `.github/workflows/android.yml` to get a debug APK artifact.
 */
const config: CapacitorConfig = {
  appId: 'app.meshmaps.map',
  appName: 'MeshMaps',
  webDir: 'dist',
  backgroundColor: '#070a10',
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: '#070a10',
      showSpinner: false,
    },
  },
}

export default config
