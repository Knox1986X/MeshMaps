/**
 * Saving files inside the Android shell.
 *
 * Capacitor's WebView has no download manager, so `<a download>` + `blob:` URLs do
 * nothing there — the export buttons looked dead in the APK. Until a native
 * Filesystem/Share plugin is wired in (TODO: full version), we show the payload in a
 * panel: JSON/GPX can be copied to the clipboard, images can be stored with the
 * WebView's own long-press → «Сохранить изображение» menu.
 */

type NativeWindow = Window & {
  Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string }
}

export function isNativeShell(): boolean {
  if (typeof window === 'undefined') return false
  const cap = (window as NativeWindow).Capacitor
  if (!cap) return false
  if (typeof cap.isNativePlatform === 'function') return cap.isNativePlatform()
  const platform = typeof cap.getPlatform === 'function' ? cap.getPlatform() : 'web'
  return platform === 'android' || platform === 'ios'
}

const readText = (blob: Blob): Promise<string> => {
  if (typeof FileReader === 'undefined') return blob.text()
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => resolve('')
    reader.readAsText(blob)
  })
}

const readDataUrl = async (blob: Blob): Promise<string> => {
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result ?? ''))
      reader.onerror = () => resolve('')
      reader.readAsDataURL(blob)
    })
  }
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(binary)}`
}

const BTN =
  'appearance:none;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);' +
  'color:#e8edf7;border-radius:10px;padding:6px 12px;font:inherit;font-size:12px;cursor:pointer'

/** Shows the export payload so it can be copied / saved by hand. */
export async function presentFileFallback(name: string, blob: Blob, mime: string): Promise<void> {
  const isImage = mime.startsWith('image/')
  const payload = isImage ? await readDataUrl(blob) : await readText(blob)

  document.querySelector('[data-mm-native-save]')?.remove()

  const root = document.createElement('div')
  root.setAttribute('data-mm-native-save', '1')
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-label', `Файл ${name}`)
  root.style.cssText =
    'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;' +
    'padding:18px;background:rgba(3,7,15,.74);backdrop-filter:blur(8px)'

  const card = document.createElement('div')
  card.style.cssText =
    'width:min(560px,100%);max-height:86vh;display:flex;flex-direction:column;gap:10px;' +
    'background:#121823;border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:14px;' +
    'color:#e8edf7;font:13px/1.45 Inter,system-ui,-apple-system,sans-serif;' +
    'box-shadow:0 24px 60px -18px rgba(0,0,0,.8)'

  const head = document.createElement('div')
  head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px'
  const title = document.createElement('strong')
  title.textContent = name
  title.style.cssText = 'font-size:13px;font-weight:600;word-break:break-all'
  const close = document.createElement('button')
  close.type = 'button'
  close.textContent = 'Закрыть'
  close.style.cssText = BTN
  close.onclick = () => root.remove()
  head.append(title, close)

  const hint = document.createElement('p')
  hint.style.cssText = 'margin:0;color:#93a1b8;font-size:11.5px;line-height:1.4'
  hint.textContent = isImage
    ? 'Долгое нажатие на картинку → «Сохранить изображение». В браузере файл скачивается сразу.'
    : 'Скопируйте текст и сохраните его в файл (или вставьте в чат / заметки). В браузере файл скачивается сразу.'

  card.append(head, hint)

  if (isImage) {
    const img = document.createElement('img')
    img.src = payload
    img.alt = name
    img.style.cssText = 'max-width:100%;max-height:60vh;border-radius:12px;object-fit:contain;background:#0b0f16'
    card.append(img)
  } else {
    const area = document.createElement('textarea')
    area.readOnly = true
    area.value = payload
    area.rows = 12
    area.style.cssText =
      'width:100%;resize:vertical;background:#0b0f16;border:1px solid rgba(255,255,255,.1);' +
      'border-radius:12px;padding:10px;color:#cfd8e6;font:11.5px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace'
    const row = document.createElement('div')
    row.style.cssText = 'display:flex;gap:8px;align-items:center'
    const copy = document.createElement('button')
    copy.type = 'button'
    copy.textContent = 'Копировать'
    copy.style.cssText = BTN
    copy.onclick = async () => {
      try {
        area.select()
        await navigator.clipboard.writeText(payload)
        copy.textContent = 'Скопировано ✓'
      } catch {
        copy.textContent = 'Выделите вручную'
        area.focus()
      }
    }
    row.append(copy)
    card.append(row, area)
  }

  root.append(card)
  root.addEventListener('click', (e) => {
    if (e.target === root) root.remove()
  })
  document.body.append(root)
}

/** Removes the fallback panel (used by tests / navigation). */
export function dismissFileFallback(): void {
  document.querySelector('[data-mm-native-save]')?.remove()
}
