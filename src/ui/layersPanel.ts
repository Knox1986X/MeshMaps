import { appState } from '../core/store';
import { drawStore } from '../core/draw';
import { startRecording } from '../core/recorder';
import { startDrawing } from '../map/drawing';
import { db, type LayerRecord } from '../storage/db';
import { createLayer, deleteLayer, moveLayer, updateLayer } from '../storage/userData';
import { importGPX, importGeoJSON, restoreBackup, saveBackup, saveGeoJSON, saveGPX } from '../storage/exchange';
import { el, ICON } from './dom';

let targetLayerId: string | null = null;
let panelError: string | null = null;

const refresh = () => appState.set({ userRev: appState.get().userRev + 1 });

function fail(err: unknown): void {
  panelError = err instanceof Error ? err.message : String(err);
  refresh();
}

async function importFile(file: File): Promise<void> {
  panelError = null;
  try {
    const name = file.name.replace(/\.[^.]+$/, '');
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.zip')) {
      await restoreBackup(file);
    } else if (lower.endsWith('.gpx')) {
      await importGPX(await file.text(), name);
    } else {
      await importGeoJSON(await file.text(), name);
    }
  } catch (err) {
    fail(err);
  }
  refresh();
}

function btn(label: string, cls: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', cls, label);
  b.onclick = onClick;
  return b;
}

async function layerRow(l: LayerRecord, index: number, total: number): Promise<HTMLElement> {
  const row = el('div', 'mm-layer glass');
  const color = el('input');
  color.type = 'color';
  color.value = l.color;
  color.className = 'mm-swatch';
  color.onchange = () => updateLayer(l.id, { color: color.value });

  const name = el('input', 'mm-input mm-layer-name');
  name.value = l.name;
  name.onchange = () => updateLayer(l.id, { name: name.value.trim() || l.name });

  const visible = el('input');
  visible.type = 'checkbox';
  visible.checked = l.visible;
  visible.title = 'Показывать на карте';
  visible.onchange = () => updateLayer(l.id, { visible: visible.checked });

  const count = await db.features.where('layerId').equals(l.id).count();
  const meta = el('span', 'mm-muted', `${count} об.`);

  const up = btn('↑', 'mm-btn mm-btn-ghost mm-btn-sm', () => moveLayer(l.id, -1));
  up.disabled = index === 0;
  const down = btn('↓', 'mm-btn mm-btn-ghost mm-btn-sm', () => moveLayer(l.id, 1));
  down.disabled = index === total - 1;
  const del = btn('', 'mm-btn mm-btn-danger mm-btn-sm', async () => {
    if (!confirm(`Удалить слой «${l.name}» и все его объекты (${count})?`)) return;
    await deleteLayer(l.id);
    if (targetLayerId === l.id) targetLayerId = null;
    refresh();
  });
  del.innerHTML = ICON.close;

  const head = el('div', 'mm-layer-head');
  head.append(color, name, visible);
  const tools = el('div', 'mm-actions wrap');
  tools.append(meta, up, down, del);
  row.append(head, tools);
  return row;
}

/** Content of the «Слои» sheet: drawing tools, layer list, import/export, backup, recording. */
export async function renderLayersPanel(box: HTMLElement): Promise<void> {
  const layers = await db.layers.orderBy('order').toArray();
  if (!targetLayerId || !layers.some((l) => l.id === targetLayerId)) targetLayerId = layers[0]?.id ?? null;
  box.replaceChildren();

  const target = el('select', 'mm-input');
  for (const l of layers) {
    const o = el('option', '', l.name);
    o.value = l.id;
    target.appendChild(o);
  }
  target.value = targetLayerId ?? '';
  target.onchange = () => {
    targetLayerId = target.value;
  };
  box.append(el('p', 'mm-muted', 'Новые объекты попадут в слой:'), target);

  const tools = el('div', 'mm-actions wrap');
  const need = () => targetLayerId ?? layers[0]?.id ?? null;
  tools.append(
    btn('Линия', 'mm-btn btn-grad mm-btn-sm', () => {
      const id = need();
      if (id) startDrawing('line', id);
    }),
    btn('Зона', 'mm-btn btn-grad mm-btn-sm', () => {
      const id = need();
      if (id) startDrawing('polygon', id);
    }),
    btn('POI', 'mm-btn btn-grad mm-btn-sm', () => {
      const id = need();
      if (id) {
        drawStore.set({ mode: 'poi', layerId: id, points: [] });
        appState.set({ tab: 'map' });
      }
    }),
    btn('Запись трека', 'mm-btn mm-btn-ghost mm-btn-sm', async () => {
      const id = need();
      if (!id) return;
      try {
        await startRecording(id);
      } catch (err) {
        fail(err);
      }
    }),
  );
  box.append(tools);

  box.append(el('h4', 'mm-sub', 'Слои'));
  const list = el('div', 'mm-layer-list');
  for (let i = 0; i < layers.length; i++) list.append(await layerRow(layers[i], i, layers.length));
  if (layers.length === 0) list.append(el('p', 'mm-muted', 'Слоёв нет. Создайте новый.'));
  box.append(list);
  box.append(
    btn('+ Новый слой', 'mm-btn btn-grad mm-btn-sm', async () => {
      await createLayer(`Слой ${layers.length + 1}`);
      refresh();
    }),
  );

  box.append(el('h4', 'mm-sub', 'Импорт и экспорт'));
  const io = el('div', 'mm-actions wrap');
  const importInput = el('input');
  importInput.type = 'file';
  importInput.accept = '.geojson,.json,.gpx,.zip,application/geo+json,application/gpx+xml,application/zip';
  importInput.hidden = true;
  importInput.onchange = () => {
    const f = importInput.files?.[0];
    importInput.value = '';
    if (f) void importFile(f);
  };
  const importLabel = el('label', 'mm-btn mm-btn-ghost mm-btn-sm');
  importLabel.append(el('span', '', 'Импорт'), importInput);
  io.append(
    importLabel,
    btn('GeoJSON', 'mm-btn mm-btn-ghost mm-btn-sm', () => void saveGeoJSON().catch(fail)),
    btn('GPX', 'mm-btn mm-btn-ghost mm-btn-sm', () => void saveGPX().catch(fail)),
    btn('Бэкап .zip', 'mm-btn mm-btn-ghost mm-btn-sm', () => void saveBackup().catch(fail)),
  );
  box.append(io);
  if (panelError) box.append(el('p', 'mm-error', panelError));
}
