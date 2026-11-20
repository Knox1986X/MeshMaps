/**
 * Headless UI smoke test: mounts the whole React tree inside jsdom.
 * WebGL is unavailable here, so MapCanvas is expected to show its fallback —
 * everything else (panels, store wiring, effects) must render without errors.
 *   npm run test:ui
 */
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html data-theme="dark"><body><div id="root"></div></body></html>', {
  url: 'https://meshmaps.app/',
  pretendToBeVisual: true,
})

const g = globalThis as unknown as Record<string, unknown>
const w = dom.window as unknown as Record<string, unknown>

const raf = (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 16) as unknown as number
const caf = (id: number) => clearTimeout(id)

g.window = dom.window
g.document = dom.window.document
try {
  Object.defineProperty(g, 'navigator', { value: dom.window.navigator, configurable: true, writable: true })
} catch {
  /* node 22 exposes a getter-only navigator */
}
g.HTMLElement = dom.window.HTMLElement
g.Element = dom.window.Element
g.Node = dom.window.Node
g.SVGElement = dom.window.SVGElement
g.CustomEvent = dom.window.CustomEvent
g.Event = dom.window.Event
g.MouseEvent = dom.window.MouseEvent
g.KeyboardEvent = dom.window.KeyboardEvent
g.DOMParser = dom.window.DOMParser
g.getComputedStyle = dom.window.getComputedStyle.bind(dom.window)
g.requestAnimationFrame = raf
g.cancelAnimationFrame = caf
w.requestAnimationFrame = raf
w.cancelAnimationFrame = caf
g.localStorage = dom.window.localStorage
g.Image = dom.window.Image
g.HTMLCanvasElement = dom.window.HTMLCanvasElement
let mobileMode = false
g.matchMedia = (query: string) => ({
  matches: mobileMode && /max-width/.test(query),
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
})
w.matchMedia = g.matchMedia
g.devicePixelRatio = 1
w.devicePixelRatio = 1
g.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
w.ResizeObserver = g.ResizeObserver
g.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}
// maplibre-gl touches these at module init
const URLshim = dom.window.URL as unknown as {
  createObjectURL?: () => string
  revokeObjectURL?: () => void
}
URLshim.createObjectURL = () => 'blob:mock'
URLshim.revokeObjectURL = () => {}
g.URL = dom.window.URL
w.URL = dom.window.URL
g.Worker = class {
  postMessage() {}
  terminate() {}
  addEventListener() {}
  removeEventListener() {}
}
w.Worker = g.Worker

if (!(dom.window as unknown as { crypto?: unknown }).crypto) {
  g.crypto = globalThis.crypto
}

// canvas / WebGL is not implemented in jsdom
dom.window.HTMLCanvasElement.prototype.getContext = function () {
  return null
} as unknown as typeof dom.window.HTMLCanvasElement.prototype.getContext

let failures = 0
let checks = 0
const ok = (cond: unknown, label: string, extra?: unknown) => {
  checks++
  if (cond) console.log(`✓ ${label}`)
  else {
    failures++
    console.error(`✗ ${label}`, extra ?? '')
  }
}

const errors: string[] = []
const realError = console.error
console.error = (...args: unknown[]) => {
  const text = args.map((a) => (a instanceof Error ? a.message : String(a))).join(' ')
  errors.push(text)
}

async function main() {
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { default: App } = await import('../src/App')
  const { ErrorBoundary } = await import('../src/components/ErrorBoundary')
  const { useStore } = await import('../src/store/useStore')

  const rootEl = document.getElementById('root')!
  const root = createRoot(rootEl)
  root.render(React.createElement(ErrorBoundary, null, React.createElement(App)))
  await new Promise((r) => setTimeout(r, 900))

  const html = rootEl.innerHTML
  console.error = realError

  ok(html.length > 4000, `дерево отрендерено (${html.length} символов)`)
  ok(html.includes('MeshMaps'), 'бренд в верхней панели')
  ok(html.includes('Поиск адреса'), 'поле поиска отрисовано')
  ok(html.includes('2D') && html.includes('3D'), 'переключатель 2D/3D')
  ok((html.match(/tool-btn/g) ?? []).length >= 10, 'панель инструментов: 10+ кнопок')
  ok(html.includes('Карта не запустилась'), 'graceful fallback без WebGL')
  ok(html.includes('55.75') || html.includes('37.62'), 'координаты в статус-баре')
  ok(!html.includes('Что-то пошло не так'), 'ErrorBoundary не сработал')

  ok(useStore.getState().hydrated, 'store гидратирован')
  ok(useStore.getState().objects.length >= 12, `демо-данные загружены (${useStore.getState().objects.length})`)

  // interaction: switch tool, open drawer, select object, search filter
  useStore.getState().setTool('point')
  await new Promise((r) => setTimeout(r, 60))
  ok(useStore.getState().draft?.kind === 'point', 'инструмент «точка» активирует draft')
  ok(rootEl.innerHTML.includes('Кликайте по карте'), 'подсказка рисования появилась')

  useStore.getState().setTool('fence')
  useStore.getState().setBottomOpen(true)
  await new Promise((r) => setTimeout(r, 120))
  ok(useStore.getState().tool === 'fence', 'переключение на инструмент ограждения')
  ok(rootEl.innerHTML.includes('Объекты'), 'нижняя панель объектов открыта')

  const first = useStore.getState().objects[0]
  useStore.getState().select(first.id)
  await new Promise((r) => setTimeout(r, 150))
  ok(rootEl.innerHTML.includes('Геометрия') && rootEl.innerHTML.includes('Свойства'), 'панель свойств открылась')
  ok(rootEl.innerHTML.includes(first.name.slice(0, 12)), 'имя выбранного объекта в панели')

  // regression: the properties panel must not remount its fields on store updates
  const area = rootEl.querySelector('textarea')
  ok(!!area, 'текстовое поле описания найдено')
  if (area) {
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value')?.set
    area.focus()
    setter?.call(area, 'Черновик описания')
    area.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 60))
    const other = useStore.getState().objects.find((o) => o.id !== first.id)!
    useStore.getState().updateObject(other.id, { name: 'Обновление во время ввода' })
    await new Promise((r) => setTimeout(r, 120))
    const after = rootEl.querySelector('textarea')
    ok(after === area, 'поле описания не пересоздаётся при обновлении store')
    ok(after?.value === 'Черновик описания', 'введённый текст сохраняется после обновления store')
    ok(dom.window.document.activeElement === area, 'фокус не теряется')
  }

  useStore.getState().setFilter({ query: 'кофейня' })
  await new Promise((r) => setTimeout(r, 80))
  ok(useStore.getState().filters.query === 'кофейня', 'фильтр поиска записан')

  useStore.getState().setMode('3d')
  useStore.getState().toggleTheme()
  await new Promise((r) => setTimeout(r, 120))
  ok(useStore.getState().mode === '3d', '3D-режим включается')
  ok(useStore.getState().theme === 'light', 'тема переключается')
  ok(document.documentElement.dataset.theme === 'light', 'data-theme обновлён для CSS-токенов')

  useStore.getState().setModal('legend')
  await new Promise((r) => setTimeout(r, 200))
  ok(rootEl.innerHTML.includes('Легенда') && rootEl.innerHTML.includes('Типы ограждений'), 'модалка легенды открывается')
  useStore.getState().setModal(null)
  await new Promise((r) => setTimeout(r, 200))

  /* Android shell: exports must show a panel instead of a dead <a download> */
  ;(dom.window as unknown as Record<string, unknown>).Capacitor = { isNativePlatform: () => true }
  const { download } = await import('../src/features/actions')
  const { dismissFileFallback } = await import('../src/utils/nativeSave')
  download('meshmaps-test.geojson', '{"type":"FeatureCollection","features":[]}', 'application/geo+json')
  await new Promise((r) => setTimeout(r, 120))
  const panel = document.querySelector('[data-mm-native-save]')
  ok(!!panel, 'в Android-оболочке экспорт показывает панель сохранения')
  const area2 = panel?.querySelector('textarea')
  ok(!!area2?.value.includes('FeatureCollection'), 'панель содержит текст файла')
  ok(!!panel?.textContent?.includes('Копировать'), 'есть кнопка копирования')
  dismissFileFallback()
  ;(dom.window as unknown as Record<string, unknown>).Capacitor = { isNativePlatform: () => false }
  download('meshmaps-test.geojson', '{}', 'application/geo+json')
  await new Promise((r) => setTimeout(r, 60))
  ok(!document.querySelector('[data-mm-native-save]'), 'в браузере панель не появляется (обычное скачивание)')

  /* offline packs UI */
  useStore.getState().setOfflineOpen(true)
  await new Promise((r) => setTimeout(r, 250))
  const offlineHtml = rootEl.innerHTML
  ok(offlineHtml.includes('Офлайн-карты'), 'модалка офлайн-карт открывается')
  ok(offlineHtml.includes('Курган'), 'в каталоге виден город Курган')
  ok(offlineHtml.includes('Скачать'), 'у набора есть кнопка скачивания')
  useStore.getState().setOfflineOpen(false)
  await new Promise((r) => setTimeout(r, 200))

  /* performance profile in settings */
  useStore.getState().setModal('settings')
  await new Promise((r) => setTimeout(r, 240))
  const settingsHtml = rootEl.innerHTML
  ok(settingsHtml.includes('Скорость и ресурсы'), 'в настройках есть раздел «Скорость и ресурсы»')
  ok(settingsHtml.includes('Экономия') && settingsHtml.includes('Максимум'), 'три режима производительности на выбор')
  ok(settingsHtml.includes('3D-рельеф'), 'рельеф можно выключить вручную')
  useStore.getState().patchSettings({ perf: 'lite' })
  await new Promise((r) => setTimeout(r, 240))
  ok(document.documentElement.dataset.perf === 'lite', 'data-perf=lite включает CSS без размытия')
  useStore.getState().patchSettings({ perf: 'full' })
  await new Promise((r) => setTimeout(r, 240))
  ok(document.documentElement.dataset.perf === 'full', 'data-perf=full возвращает размытие')
  useStore.getState().setModal(null)
  await new Promise((r) => setTimeout(r, 200))

  /* mobile layout: search overlay + bottom-sheet popovers */
  mobileMode = true
  const { TopBar } = await import('../src/components/TopBar')
  const { Toolbar } = await import('../src/components/Toolbar')
  const mobileEl = document.createElement('div')
  document.body.appendChild(mobileEl)
  const mobileRoot = createRoot(mobileEl)
  mobileRoot.render(React.createElement(React.Fragment, null, React.createElement(TopBar), React.createElement(Toolbar)))
  await new Promise((r) => setTimeout(r, 250))
  const click = (el: Element | null) =>
    el?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))

  const searchBtn = mobileEl.querySelector('[data-mm-search-open]')
  ok(!!searchBtn, 'на телефоне есть кнопка поиска')
  const inlineSearch = mobileEl.querySelector('#mm-search')
  ok(!inlineSearch, 'на телефоне поле поиска не сжато в невидимую полоску')
  click(searchBtn)
  await new Promise((r) => setTimeout(r, 200))
  ok(!!mobileEl.querySelector('[data-mm-search-close]'), 'поиск раскрывается на весь экран')
  ok(!!mobileEl.querySelector('#mm-search'), 'в раскрытом поиске есть поле ввода')
  click(mobileEl.querySelector('[data-mm-search-close]'))
  await new Promise((r) => setTimeout(r, 150))

  const sparkles = mobileEl.querySelector('button[title="Шаблоны объектов"]')
  ok(!!sparkles, 'кнопка шаблонов на месте')
  click(sparkles)
  await new Promise((r) => setTimeout(r, 300))
  const sheet = document.querySelector('.popover-sheet')
  ok(!!sheet, 'на телефоне панель шаблонов открывается как bottom sheet, а не поверх тулбара')
  ok(!!sheet?.querySelector('[aria-label="Закрыть"]'), 'у шита есть кнопка закрытия')
  ok(!!document.querySelector('.popover-scrim'), 'под шитом есть подложка (тап мимо закрывает)')
  click(document.querySelector('.popover-scrim'))
  await new Promise((r) => setTimeout(r, 250))
  ok(!document.querySelector('.popover-sheet'), 'тап по подложке закрывает шит')
  mobileRoot.unmount()
  mobileEl.remove()
  mobileMode = false

  const realErrors = errors.filter(
    (e) =>
      !/WebGL|not implemented|getContext|maplibre|Failed to fetch|IndexedDB|indexedDB|IDB|Dexie/i.test(e) &&
      !/validateDOMNesting|findDOMNode|devicePixelRatio/i.test(e),
  )
  ok(realErrors.length === 0, 'нет ошибок React в консоли', realErrors.slice(0, 3))

  root.unmount()
  console.log(`\n${failures === 0 ? '✅' : '❌'} ${checks - failures}/${checks} UI-проверок пройдено`)
  if (failures) process.exit(1)
}

main().catch((err) => {
  console.error = realError
  console.error('ui-smoke failed:', err)
  process.exit(1)
})
