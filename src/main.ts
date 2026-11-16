import 'maplibre-gl/dist/maplibre-gl.css';
import { createMap } from './map/createMap';
import { pickAt } from './map/picking';
import { setBboxDraft } from './map/highlight';
import { useRegion } from './map/regionSource';
import { appState } from './core/store';
import { draftRect } from './core/geo';
import { formatCoords } from './core/format';
import { db } from './storage/db';
import { seedPresets } from './storage/regionsService';
import { mountControls } from './ui/controls';
import { attachLocation } from './map/location';
import { mountCard } from './ui/card';
import { mountBottomNav } from './ui/bottomNav';
import { renderRegionsPanel } from './ui/regionsPanel';
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

  const hud = el('div', 'mm-hud glass');
  hud.hidden = true;
  ui.appendChild(hud);
  const toast = el('div', 'mm-toast glass');
  toast.hidden = true;
  ui.appendChild(toast);
  let toastTimer = 0;

  attachLocation(map);
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

  mountControls(ui, map);
  mountCard(ui, map);
  mountBottomNav(ui, {
    route: (box) => {
      const s = appState.get();
      if (!s.routeTo) {
        box.append(el('p', 'mm-muted', 'Выберите объект на карте и нажмите «Маршрут сюда».'));
        return;
      }
      box.append(
        el('p', '', `Пункт назначения: ${s.routeTo.name}`),
        el('p', 'mm-muted', formatCoords(s.routeTo.lat, s.routeTo.lng)),
        el('p', 'mm-muted', 'Построение офлайн-маршрута появится на этапе 6.'),
      );
    },
    layers: (box) => box.append(el('p', 'mm-muted', 'Слои откроются на этапе 5.')),
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

  appState.subscribe((s, prev) => {
    if (s.bboxDraft !== prev.bboxDraft) {
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
    }
    if (s.bboxDraft && s.bboxDraft.a && s.bboxDraft.b && s.tab === 'regions') {
      banner.hidden = true;
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
    appState.set({ selected: pickAt(map, e) });
  });
  map.on('pitchend', () => {
    appState.set({ is3D: map.getPitch() > 1 });
  });
}

boot().catch((err) => {
  console.error('[MeshMaps] boot failed', err);
  document.getElementById('app')!.textContent = 'Не удалось загрузить карту: ' + String(err);
});
