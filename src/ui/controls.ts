import type { Map as MlMap } from 'maplibre-gl';
import { appState, type LocationMode } from '../core/store';
import { startTracking } from '../core/location';
import { el, ICON } from './dom';

const NEXT_MODE: Record<LocationMode, LocationMode> = { off: 'follow', follow: 'nav', nav: 'off' };

/** Floating right-side controls: locate/follow/nav, zoom, compass, 2D/3D. */
export function mountControls(root: HTMLElement, map: MlMap): void {
  const col = el('div', 'mm-fab-col');

  const locate = el('button', 'mm-fab glass');
  locate.title = 'Моя позиция: следовать / навигация';
  const syncLocate = () => {
    const m = appState.get().locationMode;
    locate.classList.toggle('on', m !== 'off');
    locate.innerHTML = m === 'nav' ? ICON.navigate : ICON.locate;
  };
  locate.onclick = async () => {
    const current = appState.get().locationMode;
    const next = NEXT_MODE[current];
    if (next !== 'off') {
      try {
        await startTracking();
      } catch (err) {
        appState.set({ locationError: err instanceof Error ? err.message : String(err) });
        return;
      }
    }
    appState.set({ locationMode: next });
  };
  appState.subscribe(syncLocate);
  syncLocate();

  const zoomIn = el('button', 'mm-fab glass');
  zoomIn.innerHTML = ICON.plus;
  zoomIn.title = 'Приблизить';
  zoomIn.onclick = () => map.zoomIn({ duration: 250 });

  const zoomOut = el('button', 'mm-fab glass');
  zoomOut.innerHTML = ICON.minus;
  zoomOut.title = 'Отдалить';
  zoomOut.onclick = () => map.zoomOut({ duration: 250 });

  const compass = el('button', 'mm-fab glass');
  compass.innerHTML = ICON.compass;
  compass.title = 'Сбросить поворот на север';
  compass.onclick = () => {
    appState.set({ locationMode: 'off' });
    map.easeTo({ bearing: 0, duration: 400 });
  };
  map.on('rotate', () => {
    compass.style.transform = `rotate(${-map.getBearing()}deg)`;
  });

  const toggle3d = el('button', 'mm-fab mm-fab-accent');
  toggle3d.title = 'Переключить 2D / 3D';
  const syncToggle = () => {
    const is3D = appState.get().is3D;
    toggle3d.classList.toggle('on', is3D);
    toggle3d.innerHTML = is3D ? ICON.dot3d : '<span style="font-weight:700;font-size:14px">2D</span>';
  };
  toggle3d.onclick = () => {
    const next = !appState.get().is3D;
    appState.set({ is3D: next });
    map.easeTo({ pitch: next ? 55 : 0, duration: 400 });
  };
  appState.subscribe(syncToggle);
  syncToggle();

  col.append(locate, zoomIn, zoomOut, compass, toggle3d);
  root.appendChild(col);
}
