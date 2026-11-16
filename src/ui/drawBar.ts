import { drawStore, resetDraw, type DrawState } from '../core/draw';
import { stopRecording } from '../core/recorder';
import { commitGeometry, deleteSelectedVertex, lengthOf, undoPoint } from '../map/drawing';
import { db } from '../storage/db';
import { formatMeters, ringArea } from '../core/geo';
import { LINE_TYPE_RU, PASSABILITY_RU, type LineType, type Passability } from '../core/types';
import { el } from './dom';
import { appState } from '../core/store';

function selectOf<T extends string>(labels: Record<T, string>): HTMLSelectElement {
  const sel = el('select', 'mm-input');
  (Object.keys(labels) as T[]).forEach((k) => {
    const o = el('option', '', labels[k]);
    o.value = k;
    sel.appendChild(o);
  });
  return sel;
}

/** Bottom bar with drawing / editing / recording controls. Built once, toggled by drawStore. */
export function mountDrawBar(root: HTMLElement): void {
  const bar = el('section', 'mm-draw glass');
  bar.hidden = true;

  const title = el('h3', 'mm-draw-title');
  const info = el('p', 'mm-muted mm-draw-info');

  const nameInput = el('input', 'mm-input');
  nameInput.placeholder = 'Название (необязательно)';
  const typeSel = selectOf<LineType>(LINE_TYPE_RU);
  const passSel = selectOf<Passability>(PASSABILITY_RU);
  const layerSel = el('select', 'mm-input');
  const snap = el('input');
  snap.type = 'checkbox';
  const snapLabel = el('label', 'mm-check');
  snapLabel.append(snap, el('span', '', 'Привязка к дорогам'));
  snap.onchange = () => drawStore.set({ snap: snap.checked });

  const fieldsRow = el('div', 'mm-draw-row');
  fieldsRow.append(nameInput, layerSel);
  const attrRow = el('div', 'mm-draw-row');
  attrRow.append(typeSel, passSel);
  const btns = el('div', 'mm-actions wrap');

  const mkBtn = (label: string, cls: string, onClick: () => void) => {
    const b = el('button', cls, label);
    b.onclick = onClick;
    return b;
  };
  const bUndo = mkBtn('Назад', 'mm-btn mm-btn-ghost mm-btn-sm', () => undoPoint());
  const bDelV = mkBtn('Удалить вершину', 'mm-btn mm-btn-ghost mm-btn-sm', () => deleteSelectedVertex());
  const bSave = mkBtn('Сохранить', 'mm-btn btn-grad mm-btn-sm', () => void save());
  const bStop = mkBtn('Стоп и сохранить', 'mm-btn btn-grad mm-btn-sm', () => void stopRec(true));
  const bCancel = mkBtn('Отмена', 'mm-btn mm-btn-danger mm-btn-sm', () => cancel());
  btns.append(bUndo, bDelV, bSave, bStop, bCancel);

  bar.append(title, info, fieldsRow, attrRow, snapLabel, btns);
  root.appendChild(bar);

  const cancel = () => {
    if (drawStore.get().mode === 'record') {
      void stopRecording(false);
    } else {
      resetDraw();
    }
  };
  const stopRec = async (save: boolean) => {
    const ok = await stopRecording(save);
    if (save && !ok) appState.set({ locationError: 'Трек слишком короткий: нужно хотя бы 2 точки' });
  };

  const save = async () => {
    const s = drawStore.get();
    const layerId = layerSel.value || s.layerId;
    if (!layerId) return;
    const defaultName = s.polygon ? 'Зона' : LINE_TYPE_RU[typeSel.value as LineType];
    const ok = await commitGeometry({
      name: nameInput.value.trim() || defaultName,
      lineType: typeSel.value as LineType,
      passability: passSel.value as Passability,
      layerId,
    });
    if (ok) nameInput.value = '';
    else appState.set({ locationError: s.polygon ? 'Для зоны нужно минимум 3 точки' : 'Для линии нужно минимум 2 точки' });
  };

  const syncLayers = async () => {
    const layers = await db.layers.orderBy('order').toArray();
    const prev = layerSel.value;
    layerSel.replaceChildren(
      ...layers.map((l) => {
        const o = el('option', '', l.name);
        o.value = l.id;
        return o;
      }),
    );
    if (layers.some((l) => l.id === prev)) layerSel.value = prev;
    else if (drawStore.get().layerId) layerSel.value = drawStore.get().layerId!;
  };

  const sync = (s: DrawState) => {
    const mode = s.mode;
    bar.hidden = mode === 'idle' || mode === 'poi';
    if (bar.hidden) return;
    const closed = s.polygon;
    const len = lengthOf(s.points, closed);
    const isLine = !s.polygon;
    const editing = mode === 'edit';
    const recording = mode === 'record';

    title.textContent =
      mode === 'line' ? 'Новая линия' : mode === 'polygon' ? 'Новая зона' : mode === 'edit' ? 'Вершины' : 'Запись трека';
    if (recording) {
      info.textContent = `${s.points.length} точек · ${formatMeters(s.recordLength)}`;
    } else if (closed) {
      const area = s.points.length > 2 ? ringArea([...s.points, s.points[0]]) : 0;
      info.textContent = `${s.points.length} точек · периметр ${formatMeters(len)} · ${Math.round(area)} м²`;
    } else {
      info.textContent = `${s.points.length} точек · ${formatMeters(len)}${editing && s.selectedVertex !== null ? ' · выбрана вершина: тап по карте переместит её' : ''}`;
    }

    fieldsRow.hidden = editing || recording;
    attrRow.hidden = !isLine || recording;
    typeSel.hidden = !isLine || recording;
    passSel.hidden = !isLine || recording;
    snapLabel.hidden = !(mode === 'line' || mode === 'polygon');
    snap.checked = s.snap;
    bUndo.hidden = editing || recording;
    bDelV.hidden = !editing || s.selectedVertex === null;
    bSave.hidden = recording;
    bStop.hidden = !recording;
    bSave.textContent = editing ? 'Сохранить геометрию' : 'Сохранить';
    if (recording) bCancel.textContent = 'Отменить запись';
    else bCancel.textContent = 'Отмена';
  };

  drawStore.subscribe((s) => sync(s));
  appState.subscribe((s, prev) => {
    if (s.userRev !== prev.userRev) void syncLayers();
  });
  void syncLayers();
  sync(drawStore.get());
}
