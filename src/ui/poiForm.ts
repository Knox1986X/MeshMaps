import { saveFeature } from '../storage/userData';
import { el } from './dom';
import { resetDraw } from '../core/draw';
import { appState } from '../core/store';

export const POI_ICONS: { key: string; label: string }[] = [
  { key: 'dot', label: 'Точка' },
  { key: 'shop', label: 'Магазин' },
  { key: 'food', label: 'Еда' },
  { key: 'cafe', label: 'Кафе' },
  { key: 'bank', label: 'Банк' },
  { key: 'pharmacy', label: 'Аптека' },
  { key: 'hospital', label: 'Больница' },
  { key: 'fuel', label: 'АЗС' },
  { key: 'bus', label: 'Остановка' },
  { key: 'rail', label: 'Станция' },
];

/** Modal form for a new POI at the clicked point. */
export function openPoiForm(root: HTMLElement, lngLat: [number, number], layerId: string): void {
  const wrap = el('div', 'mm-modal-wrap');
  const modal = el('section', 'mm-modal glass');
  modal.append(el('h3', 'mm-sheet-title', 'Новый POI'));

  const name = el('input', 'mm-input');
  name.placeholder = 'Название';
  const desc = el('textarea', 'mm-input mm-textarea');
  desc.placeholder = 'Описание';
  let icon = 'dot';
  const iconRow = el('div', 'mm-chips');
  const chips: HTMLButtonElement[] = [];
  for (const it of POI_ICONS) {
    const c = el('button', 'chip', it.label);
    c.onclick = () => {
      icon = it.key;
      chips.forEach((x) => x.classList.toggle('active', x === c));
    };
    if (it.key === icon) c.classList.add('active');
    chips.push(c);
    iconRow.appendChild(c);
  }
  const color = el('input');
  color.type = 'color';
  color.value = '#38bdf8';
  const colorRow = el('label', 'mm-muted mm-check', 'Цвет ');
  colorRow.appendChild(color);

  let photo: Blob | null = null;
  const photoInput = el('input');
  photoInput.type = 'file';
  photoInput.accept = 'image/*';
  photoInput.setAttribute('capture', 'environment');
  const preview = el('img', 'mm-photo');
  preview.hidden = true;
  photoInput.onchange = () => {
    const f = photoInput.files?.[0];
    if (!f) return;
    photo = f;
    preview.src = URL.createObjectURL(f);
    preview.hidden = false;
  };
  const photoLabel = el('label', 'mm-btn mm-btn-ghost mm-btn-sm', 'Добавить фото');
  photoLabel.append(photoInput);

  const actions = el('div', 'mm-actions wrap');
  const save = el('button', 'mm-btn btn-grad', 'Сохранить');
  save.onclick = async () => {
    if (!name.value.trim()) {
      name.focus();
      return;
    }
    await saveFeature({
      layerId,
      kind: 'poi',
      name: name.value.trim(),
      description: desc.value.trim(),
      geometry: { type: 'Point', coordinates: lngLat },
      lineType: null,
      passability: null,
      icon,
      color: color.value,
      photo,
      source: 'draw',
    });
    close();
  };
  const cancel = el('button', 'mm-btn mm-btn-ghost', 'Отмена');
  cancel.onclick = () => close();
  actions.append(save, cancel);

  modal.append(name, desc, iconRow, colorRow, photoLabel, preview, actions);
  wrap.appendChild(modal);
  root.appendChild(wrap);
  appState.set({ tab: 'map' });
  name.focus();

  function close() {
    wrap.remove();
    resetDraw();
  }
}
