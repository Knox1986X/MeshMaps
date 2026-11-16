import type { Map as MlMap } from 'maplibre-gl';
import { appState, type PickedFeature } from '../core/store';
import { floorsFromHeight, formatCoords } from '../core/format';
import { formatMeters, lineLength, ringArea } from '../core/geo';
import { setHighlight } from '../map/highlight';
import { el, ICON } from './dom';
import { db } from '../storage/db';
import { deleteFeature, getFeature, patchFeature } from '../storage/userData';
import { startEditFeature } from '../map/drawing';
import { LINE_TYPE_RU, PASSABILITY_RU, type LineType, type Passability } from '../core/types';

const KIND_TAG: Record<PickedFeature['kind'], string> = {
  poi: 'Объект POI',
  building: '3D здание',
  road: 'Дорога',
  user: 'Мой объект',
};

/** Extra controls for user-made objects: rename, layer, type, photo, vertices, delete. */
async function appendUserActions(card: HTMLElement, fid: string, map: MlMap): Promise<void> {
  const rec = await getFeature(fid);
  if (!rec || !card.isConnected) return;
  const box = el('div', 'mm-user-actions');

  const nameInput = el('input', 'mm-input');
  nameInput.value = rec.name;
  nameInput.placeholder = 'Название';
  nameInput.onchange = () => patchFeature(fid, { name: nameInput.value.trim() });
  box.append(el('label', 'mm-muted', 'Название'), nameInput);

  const layers = await db.layers.orderBy('order').toArray();
  const layerSel = el('select', 'mm-input');
  for (const l of layers) {
    const o = el('option', '', l.name);
    o.value = l.id;
    layerSel.appendChild(o);
  }
  layerSel.value = rec.layerId;
  layerSel.onchange = () => patchFeature(fid, { layerId: layerSel.value });
  box.append(el('label', 'mm-muted', 'Слой'), layerSel);

  if (rec.kind === 'line') {
    const typeSel = el('select', 'mm-input');
    (Object.keys(LINE_TYPE_RU) as LineType[]).forEach((k) => {
      const o = el('option', '', LINE_TYPE_RU[k]);
      o.value = k;
      typeSel.appendChild(o);
    });
    typeSel.value = rec.lineType ?? 'trail';
    typeSel.onchange = () => patchFeature(fid, { lineType: typeSel.value as LineType });

    const passSel = el('select', 'mm-input');
    (Object.keys(PASSABILITY_RU) as Passability[]).forEach((k) => {
      const o = el('option', '', PASSABILITY_RU[k]);
      o.value = k;
      passSel.appendChild(o);
    });
    passSel.value = rec.passability ?? 'foot';
    passSel.onchange = () => patchFeature(fid, { passability: passSel.value as Passability });
    box.append(el('label', 'mm-muted', 'Тип'), typeSel, el('label', 'mm-muted', 'Проходимость'), passSel);
  }

  if (rec.kind === 'poi' && rec.photo) {
    const url = URL.createObjectURL(rec.photo);
    const img = el('img', 'mm-photo');
    img.src = url;
    img.alt = rec.name;
    img.onload = () => URL.revokeObjectURL(url);
    box.append(img);
  }

  const row = el('div', 'mm-actions wrap');
  if (rec.kind === 'line' || rec.kind === 'polygon') {
    const edit = el('button', 'mm-btn mm-btn-ghost mm-btn-sm', 'Править вершины');
    edit.onclick = () => startEditFeature(fid);
    row.append(edit);
  }
  const del = el('button', 'mm-btn mm-btn-danger mm-btn-sm', 'Удалить');
  del.onclick = async () => {
    if (!confirm('Удалить объект?')) return;
    await deleteFeature(fid);
    appState.set({ selected: null });
    setHighlight(map, null);
  };
  row.append(del);
  box.append(row);
  card.insertBefore(box, card.lastElementChild);
}

/** Bottom sheet card shown on tap; also drives the neon highlight layer. */
export function mountCard(root: HTMLElement, map: MlMap): void {
  const card = el('section', 'mm-card glass');
  card.hidden = true;
  root.appendChild(card);

  const render = (f: PickedFeature | null) => {
    card.replaceChildren();
    if (!f) {
      card.hidden = true;
      return;
    }
    card.hidden = false;

    const head = el('div', 'mm-card-head');
    const titles = el('div', 'mm-card-titles');
    titles.append(el('span', 'mm-tag', KIND_TAG[f.kind]), el('h2', 'mm-card-title', f.title));
    if (f.subtitle) titles.append(el('p', 'mm-muted', f.subtitle));
    const close = el('button', 'mm-icon-btn');
    close.innerHTML = ICON.close;
    close.title = 'Закрыть';
    close.onclick = () => appState.set({ selected: null });
    head.append(titles, close);

    const rows = el('dl', 'mm-rows');
    const addRow = (k: string, v: string | null) => {
      if (!v) return;
      rows.append(el('dt', 'mm-muted', k), el('dd', '', v));
    };
    addRow('Адрес', f.address);
    if (f.heightM !== null) addRow('Высота', `${Math.round(f.heightM)} м · ~${floorsFromHeight(f.heightM)} эт.`);
    const g = f.highlight.geometry;
    if (g.type === 'LineString') addRow('Длина', formatMeters(lineLength(g.coordinates as [number, number][])));
    if (g.type === 'MultiLineString') {
      addRow('Длина', formatMeters(g.coordinates.reduce((s, l) => s + lineLength(l as [number, number][]), 0)));
    }
    if (g.type === 'Polygon') addRow('Площадь', `${Math.round(ringArea(g.coordinates[0] as [number, number][]))} м²`);
    addRow('Координаты', formatCoords(f.lngLat.lat, f.lngLat.lng));

    const actions = el('div', 'mm-actions');
    const routeBtn = el('button', 'mm-btn btn-grad');
    routeBtn.innerHTML = `${ICON.route}<span>Маршрут сюда</span>`;
    routeBtn.onclick = () => {
      appState.set({
        routeTo: { lng: f.lngLat.lng, lat: f.lngLat.lat, name: f.title },
        tab: 'route',
      });
    };
    const copyBtn = el('button', 'mm-btn mm-btn-ghost');
    copyBtn.innerHTML = `${ICON.copy}<span>Копировать</span>`;
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(formatCoords(f.lngLat.lat, f.lngLat.lng));
        copyBtn.querySelector('span')!.textContent = 'Скопировано';
      } catch {
        copyBtn.querySelector('span')!.textContent = 'Нет доступа к буферу';
      }
    };
    actions.append(routeBtn, copyBtn);

    card.append(head, rows, actions);
    if (f.userFeatureId) void appendUserActions(card, f.userFeatureId, map);
  };

  appState.subscribe((s, prev) => {
    if (s.selected !== prev.selected) {
      render(s.selected);
      setHighlight(map, s.selected ? s.selected.highlight : null);
    }
  });
  render(appState.get().selected);
}
