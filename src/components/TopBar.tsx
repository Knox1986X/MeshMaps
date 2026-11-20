import { useState } from 'react'
import { useStore } from '@/store/useStore'
import { BASEMAPS } from '@/map/styles'
import type { BaseMapId, LayerVisibility } from '@/types'
import { Icon } from './Icon'
import { SearchBox } from './SearchBox'
import { IconButton, Popover, Segmented, useCompactViewport } from './ui'
import { copyShareLink, exportGeoJSON, exportGPX, exportPNG, importFile, importOsmArea, openReport } from '@/features/actions'

export function TopBar() {
  const mode = useStore((s) => s.mode)
  const toggleMode = useStore((s) => s.toggleMode)
  const setMode = useStore((s) => s.setMode)
  const theme = useStore((s) => s.theme)
  const toggleTheme = useStore((s) => s.toggleTheme)
  const basemap = useStore((s) => s.basemap)
  const setBasemap = useStore((s) => s.setBasemap)
  const layers = useStore((s) => s.layers)
  const toggleLayer = useStore((s) => s.toggleLayer)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const canUndo = useStore((s) => s.history.past.length > 0)
  const canRedo = useStore((s) => s.history.future.length > 0)
  const modal = useStore((s) => s.modal)
  const setModal = useStore((s) => s.setModal)
  const saveState = useStore((s) => s.saveState)
  const split = useStore((s) => s.split)
  const toggleSplit = useStore((s) => s.toggleSplit)
  const [mobileSearch, setMobileSearch] = useState(false)
  const compact = useCompactViewport()
  const [fileInput] = useState(() => {
    const el = document.createElement('input')
    el.type = 'file'
    el.accept = '.geojson,.json,.gpx,image/*'
    return el
  })

  const pickFile = () => {
    fileInput.value = ''
    fileInput.onchange = async () => {
      const file = fileInput.files?.[0]
      if (!file) return
      await importFile(file)
    }
    fileInput.click()
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start gap-2 p-2.5 sm:p-3">
      {/* brand */}
      <div className="panel pointer-events-auto flex h-11 shrink-0 items-center gap-2.5 pl-2 pr-3">
        <div className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-[9px] bg-gradient-to-br from-[#4f8cff] to-[#a3e635]">
          <svg viewBox="0 0 64 64" className="h-5 w-5">
            <path d="M14 46 L26 18 L38 46 L32 46 L26 32 L20 46 Z" fill="#0b0f16" />
          </svg>
        </div>
        <div className="hidden leading-none sm:block">
          <div className="text-[13px] font-semibold tracking-tight">MeshMaps</div>
          <div className="muted mt-0.5 text-[9.5px] uppercase tracking-[0.12em]">OSM · разметка</div>
        </div>
      </div>

      {/* search: inline on desktop, full-width overlay on phones */}
      {!compact && (
        <div className="pointer-events-auto w-full max-w-[420px] min-w-0">
          <SearchBox />
        </div>
      )}

      {compact && mobileSearch && (
        <div className="pointer-events-auto absolute inset-x-2.5 top-2.5 z-[70]">
          <SearchBox autoFocus onClose={() => setMobileSearch(false)} />
        </div>
      )}

      <div className="flex-1" />

      {/* actions */}
      <div className="panel pointer-events-auto flex h-11 shrink-0 items-center gap-0.5 px-1">
        <button
          className="tool-btn h-9 w-9 sm:hidden"
          onClick={() => setMobileSearch(true)}
          title="Поиск"
          data-mm-search-open="1"
        >
          <Icon name="search" size={16} />
        </button>
        <div className="hidden sm:block">
          <Segmented
            size="sm"
            value={mode}
            onChange={(v) => setMode(v)}
            options={[
              { id: '2d', label: '2D', icon: 'grid' },
              { id: '3d', label: '3D', icon: 'cube' },
            ]}
          />
        </div>
        <button className="tool-btn h-9 w-9 sm:hidden" onClick={toggleMode} title="2D / 3D">
          <Icon name={mode === '2d' ? 'grid' : 'cube'} size={16} />
        </button>

        <span className="mx-1 hidden h-5 w-px bg-[rgb(var(--line)/0.12)] sm:block" />

        <div className="hidden items-center sm:flex">
          <IconButton icon="undo" label="Отменить" kbd="⌘Z" onClick={undo} disabled={!canUndo} size={32} />
          <IconButton icon="redo" label="Повторить" kbd="⇧⌘Z" onClick={redo} disabled={!canRedo} size={32} />
        </div>

        {/* basemap */}
        <Popover
          width={248}
          trigger={(open, toggle) => (
            <IconButton icon="globe" label="Стиль карты" onClick={toggle} active={open} size={32} />
          )}
        >
          {(close) => (
            <div>
              <div className="muted px-2 pb-1 pt-1 text-[9.5px] font-semibold uppercase tracking-wider">Подложка</div>
              {(Object.keys(BASEMAPS) as BaseMapId[]).map((id) => {
                const b = BASEMAPS[id]
                return (
                  <button
                    key={id}
                    onClick={() => {
                      setBasemap(id)
                      close()
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-[rgb(var(--line)/0.08)]"
                  >
                    <span
                      className="h-5 w-5 shrink-0 rounded-md ring-1 ring-[rgb(var(--line)/0.2)]"
                      style={{ background: b.swatch }}
                    />
                    <span className="flex-1 text-left text-[12px]">{b.labelRu}</span>
                    {basemap === id && <Icon name="check" size={13} className="text-[rgb(var(--accent-soft))]" />}
                  </button>
                )
              })}
              <div className="mt-1 border-t border-[rgb(var(--line)/0.09)] pt-1">
                <div className="muted px-2 pb-1 text-[9.5px] font-semibold uppercase tracking-wider">Тема</div>
                <button
                  onClick={toggleTheme}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-[rgb(var(--line)/0.08)]"
                >
                  <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={15} className="muted" />
                  <span className="flex-1 text-left text-[12px]">
                    {theme === 'dark' ? 'Тёмная тема' : 'Светлая тема'}
                  </span>
                  <span className="muted text-[10px]">переключить</span>
                </button>
              </div>
            </div>
          )}
        </Popover>

        {/* layers */}
        <Popover
          width={258}
          trigger={(open, toggle) => <IconButton icon="layers" label="Слои" onClick={toggle} active={open} size={32} />}
        >
          {() => (
            <div>
              <div className="muted px-2 pb-1 pt-1 text-[9.5px] font-semibold uppercase tracking-wider">Слои карты</div>
              {(
                [
                  ['objects', 'Объекты', 'point'],
                  ['labels', 'Подписи', 'list'],
                  ['buildings', 'Здания', 'building'],
                  ['osm3d', 'OSM 3D-здания', 'cube'],
                  ['clusters', 'Кластеризация', 'grid'],
                  ['heatmap', 'Тепловая карта', 'heat'],
                  ['grid', 'Сетка координат', 'grid'],
                  ['hillshade', 'Рельеф (hillshade)', 'tree'],
                  ['terrain', 'Высоты (3D)', 'cube'],
                  ['shadows', 'Тени', 'moon'],
                  ['buffers', 'Буферы', 'buffer'],
                ] as [keyof LayerVisibility, string, string][]
              ).map(([key, label, icon]) => (
                <button
                  key={key}
                  onClick={() => toggleLayer(key)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-[rgb(var(--line)/0.08)]"
                >
                  <Icon name={icon} size={14} className={layers[key] ? 'text-[rgb(var(--accent-soft))]' : 'muted'} />
                  <span className="flex-1 text-left text-[12px]">{label}</span>
                  <span
                    className={`relative h-[16px] w-[28px] shrink-0 rounded-full transition-colors ${
                      layers[key] ? 'bg-[rgb(var(--accent))]' : 'bg-[rgb(var(--line)/0.18)]'
                    }`}
                  >
                    <span
                      className="absolute top-[2px] h-[12px] w-[12px] rounded-full bg-white transition-all"
                      style={{ left: layers[key] ? 14 : 2 }}
                    />
                  </span>
                </button>
              ))}
            </div>
          )}
        </Popover>

        {/* export / import */}
        <Popover
          width={236}
          trigger={(open, toggle) => <IconButton icon="share" label="Экспорт и импорт" onClick={toggle} active={open} size={32} />}
        >
          {(close) => (
            <div>
              <MenuRow icon="upload" label="Импорт GeoJSON / GPX" onClick={() => { pickFile(); close() }} />
              <MenuRow icon="download" label="Экспорт GeoJSON" onClick={() => { exportGeoJSON(); close() }} />
              <MenuRow icon="route" label="Экспорт GPX (треки)" onClick={() => { exportGPX(); close() }} />
              <MenuRow icon="camera" label="Снимок карты (PNG)" onClick={() => { exportPNG(true); close() }} />
              <MenuRow icon="chart" label="PDF-отчёт по объектам" onClick={() => { openReport(); close() }} />
              <MenuRow icon="globe" label="Скачать объекты OSM" onClick={() => { void importOsmArea(); close() }} />
              <MenuRow icon="share" label="Ссылка на этот вид" onClick={() => { copyShareLink(); close() }} />
              <MenuRow icon="expand" label={split ? 'Убрать 3D-превью' : '3D-превью (сравнение)'} onClick={() => { toggleSplit(); close() }} />
            </div>
          )}
        </Popover>

        {/* more */}
        <Popover
          width={228}
          trigger={(open, toggle) => <IconButton icon="list" label="Ещё" onClick={toggle} active={open} size={32} />}
        >
          {(close) => (
            <div>
              <MenuRow icon="eye" label="Легенда" onClick={() => { setModal('legend'); close() }} />
              <MenuRow icon="chart" label="Статистика" onClick={() => { setModal('stats'); close() }} />
              <MenuRow icon="history" label="История версий" onClick={() => { setModal('history'); close() }} />
              <MenuRow icon="database" label="Администрирование" onClick={() => { setModal('admin'); close() }} />
              <MenuRow icon="keyboard" label="Горячие клавиши" onClick={() => { setModal('shortcuts'); close() }} />
              <MenuRow icon="settings" label="Настройки" onClick={() => { setModal('settings'); close() }} />
              <div className="my-1 h-px bg-[rgb(var(--line)/0.1)]" />
              <MenuRow icon="info" label="О проекте" onClick={() => { setModal('about'); close() }} />
            </div>
          )}
        </Popover>

        <button
          className="tool-btn h-9 w-9"
          onClick={() => setModal(modal === 'settings' ? null : 'settings')}
          title="Настройки"
        >
          <Icon name="settings" size={16} />
        </button>
      </div>

      {/* save state */}
      <div className="panel pointer-events-none hidden h-11 shrink-0 items-center gap-1.5 px-3 lg:flex">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            saveState === 'saving' ? 'animate-pulse bg-[rgb(var(--warn))]' : 'bg-[rgb(var(--ok))]'
          }`}
        />
        <span className="muted text-[10.5px]">
          {saveState === 'saving' ? 'Сохранение…' : 'IndexedDB'}
        </span>
      </div>
    </div>
  )
}

function MenuRow({ icon, label, onClick, hint }: { icon: string; label: string; onClick: () => void; hint?: string }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-[rgb(var(--line)/0.08)]"
    >
      <Icon name={icon} size={14} className="muted" />
      <span className="flex-1 text-[12px]">{label}</span>
      {hint && <span className="muted font-mono text-[10px]">{hint}</span>}
    </button>
  )
}
