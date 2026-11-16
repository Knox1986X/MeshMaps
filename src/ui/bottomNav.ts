import { appState, type TabId } from '../core/store';
import { el, ICON } from './dom';

export type PanelRenderer = (box: HTMLElement) => void | Promise<void>;

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'map', label: 'Карта', icon: ICON.map },
  { id: 'route', label: 'Маршрут', icon: ICON.route_tab },
  { id: 'layers', label: 'Слои', icon: ICON.layers },
  { id: 'regions', label: 'Регионы', icon: ICON.regions },
  { id: 'settings', label: 'Настройки', icon: ICON.settings },
];

/** Bottom navigation; the sheet above it renders the panel for the active tab. */
export function mountBottomNav(root: HTMLElement, panels: Partial<Record<TabId, PanelRenderer>>): void {
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

  const renderSheet = async (tab: TabId) => {
    buttons.forEach((b, id) => b.classList.toggle('active', id === tab));
    if (tab === 'map') {
      sheet.hidden = true;
      sheet.replaceChildren();
      return;
    }
    const box = el('div', 'mm-sheet-body');
    const meta = TABS.find((t) => t.id === tab)!;
    const scroll = el('div', 'mm-sheet-scroll');
    scroll.append(el('h3', 'mm-sheet-title', meta.label), box);
    sheet.replaceChildren(scroll);
    sheet.hidden = false;
    const panel = panels[tab];
    if (panel) await panel(box);
  };

  appState.subscribe((s, prev) => {
    const changed =
      s.tab !== prev.tab ||
      s.routeTo !== prev.routeTo ||
      s.is3D !== prev.is3D ||
      s.regionsRev !== prev.regionsRev ||
      s.activeRegionId !== prev.activeRegionId ||
      s.bboxDraft !== prev.bboxDraft;
    if (changed) void renderSheet(s.tab);
  });
  void renderSheet(appState.get().tab);

  root.append(sheet, nav);
}
