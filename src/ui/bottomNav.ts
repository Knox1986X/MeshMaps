import { appState, type TabId } from '../core/store';
import { el, ICON } from './dom';
import { formatCoords } from '../core/format';

const TABS: { id: TabId; label: string; icon: string; stage: number }[] = [
  { id: 'map', label: 'Карта', icon: ICON.map, stage: 2 },
  { id: 'route', label: 'Маршрут', icon: ICON.route_tab, stage: 6 },
  { id: 'layers', label: 'Слои', icon: ICON.layers, stage: 5 },
  { id: 'regions', label: 'Регионы', icon: ICON.regions, stage: 3 },
  { id: 'settings', label: 'Настройки', icon: ICON.settings, stage: 7 },
];

/** Bottom navigation + sheet. Non-map tabs show their state; features arrive in their stage. */
export function mountBottomNav(root: HTMLElement): void {
  const sheet = el('section', 'mm-sheet glass');
  sheet.hidden = true;
  const nav = el('nav', 'mm-nav glass');

  const buttons = new Map<TabId, HTMLButtonElement>();
  for (const t of TABS) {
    const b = el('button', 'mm-nav-btn');
    b.innerHTML = `${t.icon}<span>${t.label}</span>`;
    b.onclick = () => appState.set({ tab: t.id });
    buttons.set(t.id, b);
    nav.appendChild(b);
  }

  const renderSheet = (tab: TabId) => {
    sheet.replaceChildren();
    const s = appState.get();
    if (tab === 'map') {
      sheet.hidden = true;
      return;
    }
    sheet.hidden = false;
    const meta = TABS.find((t) => t.id === tab)!;
    sheet.append(el('h3', 'mm-sheet-title', meta.label));
    if (tab === 'route') {
      if (s.routeTo) {
        sheet.append(
          el('p', '', `Пункт назначения: ${s.routeTo.name}`),
          el('p', 'mm-muted', formatCoords(s.routeTo.lat, s.routeTo.lng)),
          el('p', 'mm-muted', `Построение офлайн-маршрута: этап ${meta.stage}.`),
        );
      } else {
        sheet.append(el('p', 'mm-muted', 'Выберите объект на карте и нажмите «Маршрут сюда».'));
      }
    } else if (tab === 'settings') {
      sheet.append(
        el('p', 'mm-muted', `Режим карты: ${s.is3D ? '3D (наклон 55°)' : '2D'}`),
        el('p', 'mm-muted', 'Шрифты подписей: локальные PBF (public/fonts), без интернета.'),
        el('p', 'mm-muted', `Этап настроек: ${meta.stage}.`),
      );
    } else {
      sheet.append(el('p', 'mm-muted', `Раздел появится на этапе ${meta.stage}.`));
    }
  };

  const sync = (tab: TabId) => {
    buttons.forEach((b, id) => b.classList.toggle('active', id === tab));
    renderSheet(tab);
  };
  appState.subscribe((s, prev) => {
    if (s.tab !== prev.tab || s.routeTo !== prev.routeTo || s.is3D !== prev.is3D) sync(s.tab);
  });
  sync(appState.get().tab);

  root.append(sheet, nav);
}
