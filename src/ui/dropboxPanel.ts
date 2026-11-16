import { appState } from '../core/store';
import { formatBytes } from '../core/geo';
import {
  backupToDropbox,
  beginLogin,
  disconnect,
  finishLogin,
  forgetAppKey,
  getAppKey,
  isConnected,
  listBackups,
  restoreFromDropbox,
  setAppKey,
  type DropboxBackup,
} from '../storage/dropbox';
import { el } from './dom';

/** Settings section for the optional Dropbox backup. Renders the step the user is on. */
export async function renderDropboxPanel(box: HTMLElement): Promise<void> {
  const section = el('div', 'mm-dbx');
  box.append(section);
  await draw(section);
}

async function draw(section: HTMLElement): Promise<void> {
  const key = await getAppKey();
  const connected = await isConnected();
  section.replaceChildren(el('h4', 'mm-sub', 'Бэкап в Dropbox (необязательно)'));

  const status = el('p', 'mm-muted mm-dbx-status');
  const say = (text: string, error = false): void => {
    status.textContent = text;
    status.className = error ? 'mm-error mm-dbx-status' : 'mm-muted mm-dbx-status';
  };
  const guard = async (run: () => Promise<void>): Promise<void> => {
    try {
      await run();
    } catch (err) {
      say(err instanceof Error ? err.message : 'Неизвестная ошибка Dropbox', true);
    }
  };

  if (!key) {
    section.append(
      el(
        'p',
        'mm-muted',
        'Создайте приложение на dropbox.com/developers (тип Scoped access, доступ App folder или Full Dropbox) и введите его App Key. Секрет не нужен.',
      ),
    );
    const input = el('input', 'mm-input') as HTMLInputElement;
    input.placeholder = 'App Key';
    input.autocomplete = 'off';
    const save = el('button', 'mm-btn btn-grad', 'Сохранить App Key');
    save.onclick = () => guard(async () => {
      await setAppKey(input.value);
      await draw(section);
    });
    section.append(input, save, status);
    return;
  }

  if (!connected) {
    section.append(el('p', 'mm-muted', 'Нажмите «Подключить»: откроется страница Dropbox с кодом. Скопируйте код и вставьте его сюда.'));
    const connect = el('button', 'mm-btn btn-grad', 'Подключить Dropbox');
    connect.onclick = () => guard(async () => {
      const url = await beginLogin();
      window.open(url, '_blank', 'noopener');
      code.hidden = false;
      confirm.hidden = false;
      say('Вставьте код, который показал Dropbox.');
    });
    const code = el('input', 'mm-input') as HTMLInputElement;
    code.placeholder = 'Код из Dropbox';
    code.hidden = true;
    code.autocomplete = 'off';
    const confirm = el('button', 'mm-btn btn-grad', 'Подтвердить код');
    confirm.hidden = true;
    confirm.onclick = () => guard(async () => {
      await finishLogin(code.value);
      await draw(section);
    });
    const changeKey = el('button', 'mm-btn mm-btn-ghost mm-btn-sm', 'Изменить App Key');
    changeKey.onclick = () => guard(async () => {
      await forgetAppKey();
      await draw(section);
    });
    section.append(connect, code, confirm, status, changeKey);
    return;
  }

  section.append(el('p', 'mm-route-ok', 'Dropbox подключён. Бэкапы хранятся в папке /MeshMaps.'));
  const save = el('button', 'mm-btn btn-grad', 'Сохранить бэкап в Dropbox');
  save.onclick = () => guard(async () => {
    say('Сохраняем…');
    const path = await backupToDropbox();
    say(`Сохранено: ${path}`);
  });

  const listBox = el('div', 'mm-dbx-list');
  const restore = el('button', 'mm-btn mm-btn-ghost', 'Восстановить из Dropbox');
  restore.onclick = () => guard(async () => {
    say('Загружаем список бэкапов…');
    const backups = await listBackups();
    say(backups.length ? 'Выберите бэкап. Он добавится как новые слои, существующие данные не изменятся.' : 'В Dropbox пока нет бэкапов MeshMaps.');
    listBox.replaceChildren(...backups.map((b) => backupRow(b, say)));
  });

  const disconnectBtn = el('button', 'mm-btn mm-btn-ghost mm-btn-sm', 'Отключить Dropbox');
  disconnectBtn.onclick = () => guard(async () => {
    await disconnect();
    await draw(section);
  });

  section.append(save, restore, listBox, status, disconnectBtn);
}

function backupRow(b: DropboxBackup, say: (t: string, error?: boolean) => void): HTMLElement {
  const row = el('button', 'mm-dbx-item') as HTMLButtonElement;
  row.append(el('span', '', b.name), el('small', 'mm-muted', formatBytes(b.size)));
  row.onclick = () => {
    void (async () => {
      try {
        say('Восстанавливаем…');
        const n = await restoreFromDropbox(b);
        say(`Восстановлено объектов: ${n}`);
        appState.set({ userRev: appState.get().userRev + 1 });
      } catch (err) {
        say(err instanceof Error ? err.message : 'Не удалось восстановить бэкап', true);
      }
    })();
  };
  return row;
}
