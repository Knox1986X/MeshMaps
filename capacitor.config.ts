import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ru.meshmaps.app',
  appName: 'MeshMaps',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    backgroundColor: '#0b0f19',
    adjustMarginsForEdgeToEdge: 'auto',
  },
  plugins: {
    SplashScreen: { launchShowDuration: 0 },
    Geolocation: { },
  },
};

export default config;
