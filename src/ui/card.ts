import type { Map as MlMap } from 'maplibre-gl';
import { appState, type PickedFeature } from '../core/store';
import { floorsFromHeight, formatCoords } from '../core/format';
import { setHighlight } from '../map/highlight';
import { el, ICON } from './dom';

const KIND_TAG: Record<PickedFeature['kind'], string> = {
  poi: 'Объект POI',
  building: '3D здание',
  road: 'Дорога',
};

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
  };

  appState.subscribe((s, prev) => {
    if (s.selected !== prev.selected) {
      render(s.selected);
      setHighlight(map, s.selected ? s.selected.highlight : null);
    }
  });
  render(appState.get().selected);
}
