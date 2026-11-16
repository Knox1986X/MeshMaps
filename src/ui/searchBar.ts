import type { Map as MlMap } from 'maplibre-gl';
import { appState } from '../core/store';
import { drawStore } from '../core/draw';
import { formatCoords } from '../core/format';
import { parseCoords, type SearchHit } from '../core/search';
import { goToHit, searchAll, setSearchPin } from '../map/search';
import { el } from './dom';

const SEARCH_ICON =
  '<svg viewBox="0 0 24 24" width="20" height="20"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 16l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

/** Floating search bar over the map with results and a card for the chosen one. */
export function mountSearch(root: HTMLElement, map: MlMap): void {
  const wrap = el('div', 'mm-search');
  const bar = el('div', 'mm-search-bar glass');
  const icon = el('span', 'mm-search-icon');
  icon.innerHTML = SEARCH_ICON;
  const input = el('input', 'mm-search-input') as HTMLInputElement;
  input.type = 'search';
  input.placeholder = 'Поиск мест, улиц, координат';
  input.autocomplete = 'off';
  input.enterKeyHint = 'search';
  bar.append(icon, input);

  const results = el('div', 'mm-search-results glass');
  results.hidden = true;
  const card = el('div', 'mm-search-card glass');
  card.hidden = true;
  wrap.append(bar, results, card);
  root.append(wrap);

  let timer = 0;
  let seq = 0;

  const closeCard = (): void => {
    card.hidden = true;
    setSearchPin(map, null);
  };

  const showCard = (hit: SearchHit): void => {
    const title = el('h4', 'mm-search-title', hit.title);
    const sub = el('p', 'mm-muted', `${hit.subtitle} · ${formatCoords(hit.lat, hit.lng)}`);
    const actions = el('div', 'mm-actions wrap');
    const toHere = el('button', 'mm-btn btn-grad', 'Маршрут сюда');
    toHere.onclick = () => {
      appState.set({ routeTo: { lng: hit.lng, lat: hit.lat, name: hit.title }, tab: 'route' });
      closeCard();
    };
    const fromHere = el('button', 'mm-btn mm-btn-ghost', 'Маршрут отсюда');
    fromHere.onclick = () => {
      appState.set({ routeFrom: { lng: hit.lng, lat: hit.lat, name: hit.title }, tab: 'route' });
      closeCard();
    };
    const close = el('button', 'mm-btn mm-btn-ghost', 'Закрыть');
    close.onclick = closeCard;
    actions.append(toHere, fromHere, close);
    card.replaceChildren(title, sub, actions);
    card.hidden = false;
  };

  const select = (hit: SearchHit): void => {
    results.hidden = true;
    input.blur();
    goToHit(map, hit);
    showCard(hit);
  };

  const render = (hits: SearchHit[]): void => {
    if (hits.length === 0) {
      results.replaceChildren(
        el(
          'p',
          'mm-muted mm-search-empty',
          'Ничего не найдено. Города и области ищутся по индексу региона: откройте «Регионы» и постройте поиск.',
        ),
      );
    } else {
      results.replaceChildren(
        ...hits.map((hit) => {
          const b = el('button', 'mm-search-item') as HTMLButtonElement;
          b.append(el('span', 'mm-search-item-title', hit.title), el('small', '', hit.subtitle));
          b.onclick = () => select(hit);
          return b;
        }),
      );
    }
    results.hidden = false;
  };

  const run = async (): Promise<void> => {
    const q = input.value;
    const id = ++seq;
    if (q.trim().length < 2 && !parseCoords(q)) {
      results.hidden = true;
      return;
    }
    const hits = await searchAll(map, q);
    if (id === seq) render(hits);
  };

  input.addEventListener('input', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void run(), 220);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    window.clearTimeout(timer);
    void run().then(() => {
      const first = results.querySelector('button');
      if (first) (first as HTMLButtonElement).click();
    });
  });
  input.addEventListener('search', () => {
    if (!input.value) {
      results.hidden = true;
      closeCard();
    }
  });

  // Hidden while drawing or picking a region rectangle, where the map needs full attention.
  const sync = (): void => {
    wrap.hidden = drawStore.get().mode !== 'idle' || !!appState.get().bboxDraft;
  };
  drawStore.subscribe(sync);
  appState.subscribe((s, prev) => {
    if (s.bboxDraft !== prev.bboxDraft) sync();
  });
  sync();
}
