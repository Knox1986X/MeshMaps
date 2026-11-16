import { appState } from '../core/store';
import { PROFILE_RU, type Profile } from '../core/routing/types';
import { buildRoute, clearRoute } from '../map/route';
import { formatCoords } from '../core/format';
import { el, ICON } from './dom';

const PROFILES: Profile[] = ['foot', 'bike', 'car'];

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.max(0, Math.round(m / 10) * 10)} м`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} км`;
}

export function formatDuration(sec: number): string {
  const min = Math.max(1, Math.round(sec / 60));
  if (min < 60) return `${min} мин`;
  return `${Math.floor(min / 60)} ч ${min % 60} мин`;
}

function row(label: string, value: string, action?: { text: string; run: () => void }): HTMLElement {
  const r = el('div', 'mm-route-row');
  r.append(el('span', 'mm-muted mm-route-label', label), el('span', 'mm-route-value', value));
  if (action) {
    const b = el('button', 'mm-btn mm-btn-ghost mm-btn-sm', action.text);
    b.onclick = action.run;
    r.append(b);
  }
  return r;
}

/** Route tab: start and destination, profile, build button, summary and live progress. */
export function renderRoutePanel(box: HTMLElement): void {
  const s = appState.get();

  const from = s.routeFrom
    ? s.routeFrom.name
    : s.location
      ? 'Моё местоположение (GPS)'
      : 'GPS недоступен';
  box.append(
    row(
      'Откуда',
      from,
      s.routeFrom ? { text: 'Сбросить', run: () => appState.set({ routeFrom: null }) } : undefined,
    ),
  );

  if (s.routeTo) {
    box.append(row('Куда', s.routeTo.name), el('p', 'mm-muted', formatCoords(s.routeTo.lat, s.routeTo.lng)));
  } else {
    box.append(el('p', 'mm-muted', 'Пункт назначения не выбран. Откройте объект на карте и нажмите «Маршрут сюда».'));
  }

  const chips = el('div', 'mm-chips');
  for (const p of PROFILES) {
    const b = el('button', `chip${s.routeProfile === p ? ' active' : ''}`, PROFILE_RU[p]);
    b.onclick = () => appState.set({ routeProfile: p });
    chips.append(b);
  }
  box.append(chips);

  const build = el('button', 'mm-btn btn-grad');
  build.innerHTML = `${ICON.route}<span>${s.route ? 'Пересчитать' : 'Построить маршрут'}</span>`;
  build.disabled = !s.routeTo || s.routeBusy;
  build.onclick = () => void buildRoute();
  box.append(build);

  if (s.routeBusy) box.append(el('p', 'mm-muted', 'Считаем маршрут по офлайн-дорогам…'));
  if (s.routeError) box.append(el('p', 'mm-error', s.routeError));

  if (s.route) {
    const r = s.route;
    box.append(
      el('p', 'mm-route-summary', `${formatDistance(r.distance)} · ${formatDuration(r.duration)} · ${PROFILE_RU[r.profile]}`),
    );
    const p = s.routeProgress;
    if (p?.arrived) {
      box.append(el('p', 'mm-route-ok', 'Вы на месте'));
    } else if (p) {
      box.append(
        el(
          'p',
          '',
          `Осталось ${formatDistance(p.remainingM)} · ${formatDuration(p.remainingS)}`,
        ),
      );
      box.append(el('p', 'mm-muted', `Отклонение от маршрута: ${Math.round(p.offM)} м`));
    } else {
      box.append(el('p', 'mm-muted', 'Включите геолокацию, чтобы видеть прогресс.'));
    }
    const clear = el('button', 'mm-btn mm-btn-ghost', 'Очистить маршрут');
    clear.onclick = () => clearRoute();
    box.append(clear);
  }
}
