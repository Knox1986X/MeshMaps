import 'maplibre-gl/dist/maplibre-gl.css';
import { createMap } from './map/createMap';
import { pickAt } from './map/picking';
import { appState } from './core/store';
import { mountControls } from './ui/controls';
import { mountCard } from './ui/card';
import { mountBottomNav } from './ui/bottomNav';

async function boot(): Promise<void> {
  const app = document.getElementById('app')!;
  const mapEl = document.createElement('div');
  mapEl.id = 'map';
  app.appendChild(mapEl);

  const ui = document.createElement('div');
  ui.className = 'mm-ui';
  app.appendChild(ui);

  const brand = document.createElement('div');
  brand.className = 'mm-brand glass';
  brand.innerHTML = '<span class="mm-logo"></span><span>MeshMaps</span>';
  ui.appendChild(brand);

  const map = await createMap(mapEl);
  mountControls(ui, map);
  mountCard(ui, map);
  mountBottomNav(ui);

  map.on('click', (e) => {
    const picked = pickAt(map, e);
    appState.set({ selected: picked });
  });
  map.on('pitchend', () => {
    appState.set({ is3D: map.getPitch() > 1 });
  });
}

boot().catch((err) => {
  console.error('[MeshMaps] boot failed', err);
  document.getElementById('app')!.textContent = 'Не удалось загрузить карту: ' + String(err);
});
