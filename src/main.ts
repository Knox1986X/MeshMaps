import 'maplibre-gl/dist/maplibre-gl.css';
import { createMap } from './map/createMap';
import { pickAt } from './map/picking';
import { setBboxDraft } from './map/highlight';
import { useRegion } from './map/regionSource';
import { attachLocation } from './map/location';
import { attachRouting } from './map/route';
import { renderRoutePanel } from './ui/routePanel';
import { refreshUserSource, setUserData } from './map/userLayers';
import { attachDrawing, handleDrawClick, undoPoint } from './map/drawing';
import { appState } from './core/store';
import { drawStore, resetDraw } from './core/draw';
import { draftRect } from './core/geo';
import { db } from './storage/db';
import { ensureDefaultLayer, watchUserData } from './storage/userData';
import { seedPresets } from './storage/regionsService';
import { stopRecording } from './core/recorder';
import { mountControls } from './ui/controls';
import { mountCard } from './ui/card';
import { mountBottomNav } from './ui/bottomNav';
import { renderRegionsPanel } from './ui/regionsPanel';
import { renderLayersPanel } from './ui/layersPanel';
import { mountDrawBar } from './ui/drawBar';
import { openPoiForm } from './ui/poiForm';
import { el } from './ui/dom';

async function boot(): Promise<void> {
  const app = document.getElementById('app')!;
  const mapEl = el('div');
  mapEl.id = 'map';
  app.appendChild(mapEl);

  const ui = el('div', 'mm-ui');
  app.appendChild(ui);

  const brand = el('div', 'mm-brand glass');
  brand.innerHTML = '<span class="mm-logo"></span><span>MeshMaps</span>';
  ui.appendChild(brand);

  const banner = el('div', 'mm-banner glass');
  banner.hidden = true;
  ui.appendChild(banner);

  const map = await createMap(mapEl);

  await seedPresets();
  const defaultLayer = await ensureDefaultLayer();
  const activeId = (await db.prefs.get('activeRegion'))?.value ?? null;
  if (activeId) {
    const rec = await db.regions.get(activeId);
    if (rec?.status === 'ready') {
      try {
        await useRegion(map, rec);
        appState.set({ activeRegionId: rec.id });
      } catch (err) {
        console.error('[MeshMaps] active region failed to open', err);
      }
    }
  }

  // User objects: Dexie liveQuery keeps the map source and panels in sync with the database.
  watchUserData((layers, features) => {
    setUserData(layers, features);
    refreshUserSource(map);
    appState.set({ userRev: appState.get().userRev + 1 });
  });
  if (!drawStore.get().layerId) drawStore.set({ layerId: defaultLayer });

  attachLocation(map);
  attachRouting(map);
  attachDrawing(map);
  mountControls(ui, map);
  mountCard(ui, map);
  mountDrawBar(ui);

  const hud = el('div', 'mm-hud glass');
  hud.hidden = true;
  ui.appendChild(hud);
  const toast = el('div', 'mm-toast glass');
  toast.hidden = true;
  ui.appendChild(toast);
  let toastTimer = 0;

  appState.subscribe((s, prev) => {
    if (s.location !== prev.location || s.heading !== prev.heading) {
      if (s.location) {
        const kmh = s.location.speed != null ? Math.round(s.location.speed * 3.6) : null;
        const hdg = s.heading != null ? `${Math.round(s.heading)}°` : '—';
        hud.textContent = `±${Math.round(s.location.accuracy)} м · ${kmh != null ? kmh + ' км/ч' : 'стоим'} · ${hdg}`;
        hud.hidden = false;
      }
    }
    if (s.locationError !== prev.locationError && s.locationError) {
      toast.textContent = s.locationError;
      toast.hidden = false;
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => (toast.hidden = true), 4500);
    }
  });

  mountBottomNav(ui, {
    route: (box) => renderRoutePanel(box),
    layers: (box) => renderLayersPanel(box),
    regions: (box) => renderRegionsPanel(box, map),
    settings: (box) => {
      const s = appState.get();
      box.append(
        el('p', 'mm-muted', `Режим карты: ${s.is3D ? '3D (наклон 55°)' : '2D'}`),
        el('p', 'mm-muted', `Источник: ${s.activeRegionId ? 'офлайн-регион' : 'онлайн OpenFreeMap'}`),
        el('p', 'mm-muted', 'Шрифты подписей и иконки POI встроены в приложение.'),
      );
    },
  });

  // Region rectangle banner
  appState.subscribe((s, prev) => {
    if (s.bboxDraft === prev.bboxDraft) return;
    const d = s.bboxDraft;
    setBboxDraft(map, draftRect(d));
    if (!d) {
      banner.hidden = true;
    } else if (!d.a || !d.b) {
      banner.hidden = false;
      banner.replaceChildren(el('span', '', d.a ? 'Нажмите второй угол рамки' : 'Нажмите первый угол рамки'));
      const cancel = el('button', 'mm-btn mm-btn-ghost mm-btn-sm', 'Отмена');
      cancel.onclick = () => appState.set({ bboxDraft: null });
      banner.append(cancel);
    } else {
      banner.hidden = true;
      appState.set({ tab: 'regions' });
    }
  });

  // Drawing mode hint banner
  drawStore.subscribe((s, prev) => {
    if (s.mode === prev.mode) return;
    if (s.mode === 'poi') {
      banner.hidden = false;
      banner.replaceChildren(el('span', '', 'Нажмите на карту, чтобы поставить POI'));
      const cancel = el('button', 'mm-btn mm-btn-ghost mm-btn-sm', 'Отмена');
      cancel.onclick = () => resetDraw();
      banner.append(cancel);
    } else if (s.mode === 'line' || s.mode === 'polygon' || s.mode === 'edit') {
      banner.hidden = false;
      banner.replaceChildren(
        el('span', '', s.mode === 'edit' ? 'Тап по вершине — выбрать, затем тап по карте — переместить' : 'Тап по карте — добавить точку'),
      );
    } else if (s.mode === 'idle' || s.mode === 'record') {
      if (!appState.get().bboxDraft) banner.hidden = true;
    }
  });

  map.on('click', (e) => {
    const d = appState.get().bboxDraft;
    if (d) {
      const pt: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      if (!d.a) appState.set({ bboxDraft: { a: pt, b: null } });
      else if (!d.b) appState.set({ bboxDraft: { a: d.a, b: pt } });
      return;
    }
    const ds = drawStore.get();
    if (ds.mode === 'poi' && ds.layerId) {
      const layerId = ds.layerId;
      drawStore.set({ mode: 'idle' });
      banner.hidden = true;
      openPoiForm(app, [e.lngLat.lng, e.lngLat.lat], layerId);
      return;
    }
    if (handleDrawClick(map, e)) return;
    appState.set({ selected: pickAt(map, e) });
  });

  map.on('pitchend', () => {
    appState.set({ is3D: map.getPitch() > 1 });
  });

  // Desktop keyboard: Escape cancels drawing, Ctrl+Z removes the last vertex.
  window.addEventListener('keydown', (ev) => {
    const target = ev.target as HTMLElement;
    if (target.matches('input, textarea, select')) return;
    const mode = drawStore.get().mode;
    if (ev.key === 'Escape') {
      if (mode === 'record') void stopRecording(false);
      else if (mode !== 'idle') resetDraw();
      else appState.set({ selected: null });
    } else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z' && (mode === 'line' || mode === 'polygon')) {
      ev.preventDefault();
      undoPoint();
    }
  });
}

boot().catch((err) => {
  console.error('[MeshMaps] boot failed', err);
  document.getElementById('app')!.textContent = 'Не удалось загрузить карту: ' + String(err);
});
