import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { appState } from './store';

/** Above this speed (m/s) GPS course is trusted more than the magnetometer. */
const MOVING_SPEED = 1.5;
/** After a GPS course sample, the compass is ignored for this long. */
const GPS_HEADING_HOLD_MS = 3000;

let watchId: string | null = null;
let webWatchId: number | null = null;
let compassAttached = false;
let compassHeading: number | null = null;
let lastGpsHeadingTs = 0;

interface FixCoords {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
}

/** Shortest-path low-pass filter for angles in degrees. */
export function smoothAngle(prev: number, next: number, k: number): number {
  const d = ((next - prev + 540) % 360) - 180;
  return (prev + k * d + 360) % 360;
}

function setHeading(h: number): void {
  appState.set({ heading: h });
}

function onFix(c: FixCoords): void {
  const speed = c.speed != null && c.speed >= 0 ? c.speed : null;
  appState.set({
    location: { lng: c.longitude, lat: c.latitude, accuracy: c.accuracy, speed },
    locationError: null,
  });
  if (c.heading != null && speed != null && speed >= MOVING_SPEED) {
    lastGpsHeadingTs = Date.now();
    setHeading(c.heading);
  }
}

function onOrientation(e: DeviceOrientationEvent): void {
  if (e.alpha == null) return;
  // alpha is counter-clockwise from north for the absolute frame; compass heading is clockwise.
  const h = (360 - e.alpha) % 360;
  compassHeading = compassHeading == null ? h : smoothAngle(compassHeading, h, 0.25);
  if (Date.now() - lastGpsHeadingTs < GPS_HEADING_HOLD_MS) return;
  setHeading(compassHeading);
}

/** Attaches the compass. Must be called from a user gesture on iOS (requestPermission). */
function attachCompass(): void {
  if (compassAttached) return;
  compassAttached = true;
  const DO = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
  if (DO.requestPermission) {
    DO.requestPermission().catch(() => undefined);
  }
  const absolute = 'ondeviceorientationabsolute' in window;
  window.addEventListener(absolute ? 'deviceorientationabsolute' : 'deviceorientation', (e) =>
    onOrientation(e as DeviceOrientationEvent),
  );
}

/** Starts GPS + compass. Idempotent. */
export async function startTracking(): Promise<void> {
  attachCompass();
  if (watchId !== null || webWatchId !== null) return;

  if (Capacitor.isNativePlatform()) {
    const perm = await Geolocation.requestPermissions();
    if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
      throw new Error('Нет разрешения на геолокацию. Разрешите доступ в настройках Android.');
    }
    watchId = await Geolocation.watchPosition(
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 2000 },
      (pos, err) => {
        if (err) {
          appState.set({ locationError: `GPS: ${String(err.message ?? err)}` });
          return;
        }
        if (pos) onFix(pos.coords);
      },
    );
    return;
  }

  if (!('geolocation' in navigator)) {
    throw new Error('Геолокация недоступна в этом окружении');
  }
  webWatchId = navigator.geolocation.watchPosition(
    (p) => onFix(p.coords),
    (e) => appState.set({ locationError: `Геолокация: ${e.message || 'нет доступа'}` }),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 2000 },
  );
}
