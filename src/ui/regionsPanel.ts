import type { Map as MlMap } from 'maplibre-gl';
import { appState } from '../core/store';
import { formatBbox, formatBytes, normalizeBbox } from '../core/geo';
import { db, type RegionRecord } from '../storage/db';
import {
  createPlannedRegion,
  deleteRegion,
  importRegionFile,
  planetilerCommand,
  progress,
} from '../storage/regionsService';
import { useOnline, useRegion } from '../map/regionSource';
import { buildPlaceIndex } from '../storage/placeIndex';
import { openRegionFile } from '../storage/opfs';
import { el, ICON } from './dom';

let lastError: string | null = null;
/** Search-index build progress per region id (0..1). */
const indexing = new Map<string, number>();
let draftName = '';

const refresh = () => appState.set({ regionsRev: appState.get().regionsRev + 1 });

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

const STATUS_LABEL: Record<RegionRecord['status'], string> = {
  planned: 'Не импортирован',
  importing: 'Импорт…',
  ready: 'Готов офлайн',
  error: 'Ошибка',
};

/** Builds the offline search index of a ready region (places and POI from its archive). */
async function indexRegion(rec: RegionRecord): Promise<void> {
  if (!rec.fileName) return;
  lastError = null;
  indexing.set(rec.id, 0);
  refresh();
  let last = 0;
  try {
    const file = await openRegionFile(rec.fileName);
    await buildPlaceIndex(rec, file, (f) => {
      indexing.set(rec.id, f);
      if (f - last >= 0.05 || f === 1) {
        last = f;
        refresh();
      }
    });
  } catch (err) {
    lastError = errorText(err);
  } finally {
    indexing.delete(rec.id);
    refresh();
  }
}

async function runImport(file: File, targetId: string | null): Promise<void> {
  lastError = null;
  refresh();
  let rec: RegionRecord | null = null;
  try {
    rec = await importRegionFile(file, targetId, refresh);
  } catch (err) {
    lastError = errorText(err);
  }
  refresh();
  // A freshly imported region gets its search index right away, so search works offline immediately.
  if (rec) await indexRegion(rec);
}

async function activate(map: MlMap, rec: RegionRecord): Promise<void> {
  lastError = null;
  try {
    await useRegion(map, rec);
    await db.prefs.put({ key: 'activeRegion', value: rec.id });
    appState.set({ activeRegionId: rec.id, tab: 'map' });
  } catch (err) {
    lastError = errorText(err);
  }
  refresh();
}

async function goOnline(map: MlMap): Promise<void> {
  await useOnline(map);
  await db.prefs.put({ key: 'activeRegion', value: null });
  appState.set({ activeRegionId: null });
  refresh();
}

function fileButton(label: string, cls: string, onFile: (f: File) => void): HTMLLabelElement {
  const wrap = el('label', cls);
  wrap.append(el('span', '', label));
  const input = el('input');
  input.type = 'file';
  input.accept = '.pmtiles,application/octet-stream';
  input.hidden = true;
  input.onchange = () => {
    const f = input.files?.[0];
    input.value = '';
    if (f) onFile(f);
  };
  wrap.append(input);
  return wrap;
}

function regionCard(map: MlMap, rec: RegionRecord, active: boolean): HTMLElement {
  const card = el('article', 'mm-region glass');
  const head = el('div', 'mm-region-head');
  const titles = el('div', 'mm-region-titles');
  titles.append(el('h4', 'mm-region-title', rec.name));
  const chip = el('span', `mm-status s-${rec.status}`, STATUS_LABEL[rec.status]);
  titles.append(chip);
  if (active) titles.append(el('span', 'mm-status s-active', 'Активна'));
  head.append(titles);
  card.append(head);

  const pct = progress.get(rec.id);
  const meta = [formatBbox(rec.bbox), `zoom ${rec.minZoom}–${rec.maxZoom}`];
  if (rec.status === 'ready') meta.push(formatBytes(rec.bytes));
  card.append(el('p', 'mm-muted', meta.join(' · ')));

  if (pct !== undefined) {
    const bar = el('div', 'mm-progress');
    const fill = el('div', 'mm-progress-fill');
    fill.style.width = `${Math.round(pct * 100)}%`;
    bar.append(fill);
    card.append(bar, el('p', 'mm-muted', `${Math.round(pct * 100)}%`));
  }
  if (rec.error) card.append(el('p', 'mm-error', rec.error));

  const idx = indexing.get(rec.id);
  if (idx !== undefined) {
    const bar = el('div', 'mm-progress');
    const fill = el('div', 'mm-progress-fill');
    fill.style.width = `${Math.round(idx * 100)}%`;
    bar.append(fill);
    card.append(bar, el('p', 'mm-muted', `Строим поиск: ${Math.round(idx * 100)}%`));
  } else if (rec.status === 'ready') {
    card.append(
      el(
        'p',
        'mm-muted',
        rec.indexedAt ? `Поиск: ${new Date(rec.indexedAt).toLocaleDateString('ru-RU')}` : 'Поиск не построен: названия городов не будут найдены.',
      ),
    );
  }

  if (rec.status === 'planned' || rec.status === 'error') {
    const cmd = planetilerCommand(rec);
    const pre = el('pre', 'mm-code');
    pre.textContent = cmd;
    const copy = el('button', 'mm-btn mm-btn-ghost mm-btn-sm');
    copy.innerHTML = `${ICON.copy}<span>Скопировать команду</span>`;
    copy.onclick = async () => {
      try {
        await navigator.clipboard.writeText(cmd);
        copy.querySelector('span')!.textContent = 'Скопировано';
      } catch {
        copy.querySelector('span')!.textContent = 'Нет доступа к буферу';
      }
    };
    card.append(el('p', 'mm-muted', 'Соберите архив на компьютере (см. tools/build-region.sh) и импортируйте файл:'), pre, copy);
  }

  const actions = el('div', 'mm-actions wrap');
  if (rec.status === 'ready') {
    const open = el('button', 'mm-btn btn-grad mm-btn-sm', active ? 'Показать' : 'Открыть офлайн');
    open.onclick = () => activate(map, rec);
    actions.append(open);
    if (indexing.get(rec.id) === undefined) {
      const reindex = el('button', 'mm-btn mm-btn-ghost mm-btn-sm', rec.indexedAt ? 'Обновить поиск' : 'Построить поиск');
      reindex.onclick = () => void indexRegion(rec);
      actions.append(reindex);
    }
  }
  if (rec.status === 'planned' || rec.status === 'error') {
    actions.append(fileButton('Импорт .pmtiles', 'mm-btn mm-btn-ghost mm-btn-sm', (f) => runImport(f, rec.id)));
  }
  if (rec.status !== 'importing') {
    const del = el('button', 'mm-btn mm-btn-danger mm-btn-sm', 'Удалить');
    del.onclick = async () => {
      lastError = null;
      try {
        if (appState.get().activeRegionId === rec.id) await goOnline(map);
        await deleteRegion(rec.id);
      } catch (err) {
        lastError = errorText(err);
      }
      refresh();
    };
    actions.append(del);
  }
  card.append(actions);
  return card;
}

/** Content of the «Регионы» bottom sheet: import, rectangle selection, list. */
export async function renderRegionsPanel(box: HTMLElement, map: MlMap): Promise<void> {
  const s = appState.get();
  const regions = (await db.regions.toArray()).sort((a, b) => a.createdAt - b.createdAt);
  box.replaceChildren();

  const top = el('div', 'mm-actions wrap');
  top.append(
    fileButton('Импорт .pmtiles', 'mm-btn btn-grad', (f) => runImport(f, null)),
    (() => {
      const b = el('button', 'mm-btn mm-btn-ghost');
      b.innerHTML = `${ICON.regions}<span>Выбрать рамкой</span>`;
      b.onclick = () => appState.set({ tab: 'map', bboxDraft: { a: null, b: null } });
      return b;
    })(),
    (() => {
      const b = el('button', 'mm-btn mm-btn-ghost');
      b.innerHTML = `<span>${s.activeRegionId ? 'Онлайн-карта' : 'Онлайн активна'}</span>`;
      b.disabled = !s.activeRegionId;
      b.onclick = () => goOnline(map);
      return b;
    })(),
  );
  box.append(top);

  const draft = s.bboxDraft;
  if (draft && draft.b && draft.a) {
    const form = el('div', 'mm-draft glass');
    const rect = normalizeBbox(draft.a, draft.b);
    form.append(el('p', 'mm-muted', `Рамка: ${formatBbox(rect)}`));
    const input = el('input', 'mm-input');
    input.placeholder = 'Название региона';
    input.value = draftName;
    input.oninput = () => {
      draftName = input.value;
    };
    const create = el('button', 'mm-btn btn-grad', 'Создать регион');
    create.onclick = async () => {
      try {
        await createPlannedRegion(draftName, rect);
        draftName = '';
        appState.set({ bboxDraft: null });
      } catch (err) {
        lastError = errorText(err);
      }
      refresh();
    };
    const cancel = el('button', 'mm-btn mm-btn-ghost', 'Отмена');
    cancel.onclick = () => appState.set({ bboxDraft: null });
    const actions = el('div', 'mm-actions');
    actions.append(create, cancel);
    form.append(input, actions);
    box.append(form);
  }

  if (lastError) box.append(el('p', 'mm-error', lastError));
  if (regions.length === 0) box.append(el('p', 'mm-muted', 'Регионов пока нет. Импортируйте .pmtiles или выберите рамку на карте.'));
  for (const rec of regions) box.append(regionCard(map, rec, rec.id === s.activeRegionId));
}
