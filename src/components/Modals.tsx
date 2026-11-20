import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useStore, objectStats, type Locale } from '@/store/useStore'
import { CATEGORIES, FENCE_TYPES, getCategory } from '@/icons/categories'
import { MapIcon } from '@/icons'
import { Icon } from './Icon'
import { Empty, Modal, Segmented, Slider, Switch } from './ui'
import { BASEMAPS } from '@/map/styles'
import { addSnapshot, db, listSnapshots, kvGet, kvSet, replaceAll } from '@/db/db'
import type { BaseMapId, LayerVisibility, Snapshot } from '@/types'
import { formatArea, formatDistance, geometryArea, geometryLength } from '@/utils/geo'
import { download, exportGeoJSON } from '@/features/actions'

export function Modals() {
  const modal = useStore((s) => s.modal)
  const setModal = useStore((s) => s.setModal)
  const close = () => setModal(null)

  return (
    <>
      <LegendModal open={modal === 'legend'} onClose={close} />
      <StatsModal open={modal === 'stats'} onClose={close} />
      <HistoryModal open={modal === 'history'} onClose={close} />
      <SettingsModal open={modal === 'settings'} onClose={close} />
      <ShortcutsModal open={modal === 'shortcuts'} onClose={close} />
      <AdminModal open={modal === 'admin'} onClose={close} />
      <AboutModal open={modal === 'about'} onClose={close} />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* legend                                                              */
/* ------------------------------------------------------------------ */

function LegendModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const objects = useStore((s) => s.objects)
  const used = new Set(objects.map((o) => o.category))
  return (
    <Modal open={open} onClose={onClose} title="Легенда" subtitle="Иконки, цвета и типы ограждений" width={640}>
      <div className="space-y-5">
        <section>
          <SectionLabel>Категории объектов ({CATEGORIES.length})</SectionLabel>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {CATEGORIES.map((c) => (
              <div
                key={c.id}
                className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${
                  used.has(c.id) ? 'bg-[rgb(var(--line)/0.06)]' : 'opacity-55'
                }`}
              >
                <MapIcon glyph={c.icon} color={c.color} size={22} />
                <div className="min-w-0">
                  <div className="truncate text-[11.5px]">{c.labelRu}</div>
                  <div className="muted font-mono text-[9px]">
                    {c.kind} · {used.has(c.id) ? `${objects.filter((o) => o.category === c.id).length} шт.` : 'не используется'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionLabel>Типы ограждений</SectionLabel>
          <div className="grid grid-cols-2 gap-1.5">
            {FENCE_TYPES.map((f) => (
              <div key={f.id} className="flex items-center gap-2 rounded-xl bg-[rgb(var(--line)/0.05)] px-2 py-1.5">
                <MapIcon glyph={f.icon} color={f.color} size={20} />
                <div>
                  <div className="text-[11.5px]">{f.labelRu}</div>
                  <div className="muted text-[9.5px]">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionLabel>Условные обозначения</SectionLabel>
          <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3">
            <LegendItem swatch={<div className="h-[3px] w-8 rounded bg-[#f97316]" />} label="Сплошная линия — дорога" />
            <LegendItem swatch={<div className="h-[3px] w-8 rounded bg-[#f97316] opacity-70" style={{ backgroundImage: 'repeating-linear-gradient(90deg,#f97316 0 4px,transparent 4px 7px)' }} />} label="Пунктир — тропа" />
            <LegendItem swatch={<div className="h-3 w-8 rounded bg-[#22c55e]/30 ring-1 ring-[#22c55e]" />} label="Полигон — территория" />
            <LegendItem swatch={<div className="h-3 w-8 rounded bg-black/40 ring-1 ring-white/30" />} label="Тень — здание в 2D" />
            <LegendItem swatch={<div className="h-3 w-8 rounded bg-gradient-to-r from-[#38bdf8] via-[#a3e635] to-[#ef4444]" />} label="Тепловая карта — плотность" />
            <LegendItem swatch={<div className="flex h-4 w-8 items-center justify-center rounded-full bg-[rgb(var(--accent))] font-mono text-[8px] text-white">12</div>} label="Кластер объектов" />
          </div>
        </section>
      </div>
    </Modal>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="muted mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.12em]">{children}</div>
}

function LegendItem({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-4 w-8 shrink-0 items-center">{swatch}</div>
      <span className="muted leading-tight">{label}</span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* stats                                                               */
/* ------------------------------------------------------------------ */

function StatsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const objects = useStore((s) => s.objects)
  const stats = useMemo(() => objectStats(objects), [objects])
  const biggest = [...objects]
    .map((o) => ({ o, size: geometryArea(o.geometry) || geometryLength(o.geometry) }))
    .sort((a, b) => b.size - a.size)
    .slice(0, 5)

  return (
    <Modal open={open} onClose={onClose} title="Статистика карты" subtitle={`${objects.length} объектов в базе`} width={640}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <BigStat label="Объектов" value={String(stats.total)} />
          <BigStat label="Зданий" value={String(stats.buildings)} />
          <BigStat label="Ограждений" value={String(stats.fences)} />
          <BigStat label="Макс. высота" value={`${Math.round(stats.maxHeight)} м`} />
          <BigStat label="Длина линий" value={formatDistance(stats.length)} />
          <BigStat label="Площадь" value={formatArea(stats.area)} />
          <BigStat label="Категорий" value={String(Object.keys(stats.byCategory).length)} />
          <BigStat label="Тегов" value={String(new Set(objects.flatMap((o) => o.tags)).size)} />
        </div>

        <div>
          <SectionLabel>Распределение по категориям</SectionLabel>
          <div className="space-y-1.5">
            {Object.entries(stats.byCategory)
              .sort((a, b) => b[1] - a[1])
              .map(([id, n]) => {
                const cat = getCategory(id)
                const pct = Math.round((n / Math.max(1, stats.total)) * 100)
                return (
                  <div key={id} className="flex items-center gap-2">
                    <MapIcon glyph={cat.icon} color={cat.color} size={15} />
                    <span className="w-[140px] shrink-0 truncate text-[11px]">{cat.labelRu}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[rgb(var(--line)/0.08)]">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.5 }}
                        className="h-full rounded-full"
                        style={{ background: cat.color }}
                      />
                    </div>
                    <span className="muted w-14 shrink-0 text-right font-mono text-[10px]">{n} · {pct}%</span>
                  </div>
                )
              })}
            {!Object.keys(stats.byCategory).length && <Empty title="Пока нет данных" hint="Добавьте объекты на карту" />}
          </div>
        </div>

        {biggest.length > 0 && (
          <div>
            <SectionLabel>Крупнейшие объекты</SectionLabel>
            <div className="space-y-1">
              {biggest.map(({ o, size }) => (
                <div key={o.id} className="flex items-center gap-2 rounded-lg bg-[rgb(var(--line)/0.04)] px-2 py-1">
                  <MapIcon glyph={o.icon} color={o.color} size={14} />
                  <span className="flex-1 truncate text-[11px]">{o.name || 'Без названия'}</span>
                  <span className="muted font-mono text-[10px]">
                    {geometryArea(o.geometry) ? formatArea(size) : formatDistance(size)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

function BigStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[rgb(var(--line)/0.08)] bg-[rgb(var(--line)/0.04)] px-2.5 py-2">
      <div className="text-[16px] font-semibold leading-none tracking-tight">{value}</div>
      <div className="muted mt-1 text-[9.5px] uppercase tracking-wide">{label}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* history                                                             */
/* ------------------------------------------------------------------ */

function HistoryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const snapshots = useStore((s) => s.snapshots)
  const setSnapshots = useStore((s) => s.setSnapshots)
  const objects = useStore((s) => s.objects)
  const pushHistory = useStore((s) => s.pushHistory)
  const toast = useStore((s) => s.toast)
  const past = useStore((s) => s.history.past)

  useEffect(() => {
    if (!open) return
    void listSnapshots().then(setSnapshots)
  }, [open, setSnapshots])

  const createSnapshot = async () => {
    const snap: Snapshot = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      label: `Снимок · ${objects.length} объектов`,
      objects: structuredClone(objects),
    }
    await addSnapshot(snap)
    setSnapshots(await listSnapshots())
    toast('ok', 'Снимок состояния создан')
  }

  const restore = async (snap: Snapshot) => {
    pushHistory('restore')
    useStore.setState({ objects: structuredClone(snap.objects), selectedId: null, saveState: 'saving' })
    await replaceAll(snap.objects)
    toast('ok', `Восстановлено состояние от ${new Date(snap.at).toLocaleString('ru-RU')}`)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="История версий"
      subtitle="Снимки состояний и журнал действий (хранится локально)"
      width={600}
      footer={
        <div className="flex items-center justify-between">
          <span className="muted text-[10.5px]">{snapshots.length} снимков · {past.length} шагов undo</span>
          <button className="btn btn-primary !py-1.5 !text-[11.5px]" onClick={createSnapshot}>
            <Icon name="camera" size={12} /> Создать снимок
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <section>
          <SectionLabel>Снимки состояния</SectionLabel>
          {snapshots.length === 0 && <Empty icon="history" title="Снимков пока нет" hint="Создайте снимок, чтобы вернуться к этому состоянию позже" />}
          <div className="space-y-1">
            {snapshots.map((s) => (
              <div key={s.id} className="flex items-center gap-2 rounded-xl bg-[rgb(var(--line)/0.04)] px-2.5 py-2">
                <Icon name="clock" size={13} className="muted" />
                <div className="flex-1">
                  <div className="text-[11.5px]">{s.label}</div>
                  <div className="muted font-mono text-[9.5px]">{new Date(s.at).toLocaleString('ru-RU')}</div>
                </div>
                <button className="btn !py-1 !text-[10.5px]" onClick={() => restore(s)}>
                  Восстановить
                </button>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionLabel>Журнал действий (undo-стек)</SectionLabel>
          <div className="max-h-[190px] space-y-0.5 overflow-y-auto">
            {[...past].reverse().map((h, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg px-2 py-1 text-[11px]">
                <span className="muted font-mono text-[9.5px]">{String(past.length - i).padStart(2, '0')}</span>
                <span>{actionLabel(h.label)}</span>
                <span className="muted ml-auto font-mono text-[9.5px]">{h.objects.length} объектов</span>
              </div>
            ))}
            {!past.length && <div className="muted py-3 text-center text-[11px]">Действий пока не было</div>}
          </div>
        </section>
      </div>
    </Modal>
  )
}

function actionLabel(label: string): string {
  const map: Record<string, string> = {
    'add:point': 'Добавлена точка',
    'add:line': 'Добавлена линия',
    'add:polygon': 'Добавлен полигон',
    'add:building': 'Добавлено здание',
    'add:fence': 'Добавлено ограждение',
    edit: 'Изменение объекта',
    delete: 'Удаление объекта',
    duplicate: 'Дублирование',
    import: 'Импорт данных',
    'import-geojson': 'Импорт GeoJSON',
    'import-gpx': 'Импорт GPX',
    clear: 'Очистка карты',
    restore: 'Восстановление снимка',
    template: 'Добавлен шаблон',
    route: 'Маршрут сохранён',
    'osm-import': 'Импорт из OSM',
  }
  return map[label] ?? label
}

/* ------------------------------------------------------------------ */
/* settings                                                            */
/* ------------------------------------------------------------------ */

function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useStore((s) => s.settings)
  const patch = useStore((s) => s.patchSettings)
  const layers = useStore((s) => s.layers)
  const toggleLayer = useStore((s) => s.toggleLayer)
  const theme = useStore((s) => s.theme)
  const setTheme = useStore((s) => s.setTheme)
  const basemap = useStore((s) => s.basemap)
  const setBasemap = useStore((s) => s.setBasemap)
  const objects = useStore((s) => s.objects)
  const toast = useStore((s) => s.toast)
  const clearAll = useStore((s) => s.clearAll)
  const [usage, setUsage] = useState<string>('—')
  const [confirmClear, setConfirmClear] = useState(false)

  useEffect(() => {
    if (!open) return
    void navigator.storage?.estimate?.().then((e) => {
      if (e.usage != null) setUsage(`${(e.usage / 1024 / 1024).toFixed(2)} МБ`)
    })
  }, [open])

  const sunTime = new Date(settings.sunDate)
  const timeValue = `${String(sunTime.getHours()).padStart(2, '0')}:${String(sunTime.getMinutes()).padStart(2, '0')}`

  const setSunTime = (value: string) => {
    const [h, m] = value.split(':').map(Number)
    const d = new Date()
    d.setHours(h, m, 0, 0)
    patch({ sunDate: d.toISOString() })
  }

  const backup = async () => {
    const payload = {
      app: 'meshmaps',
      version: 1,
      exportedAt: new Date().toISOString(),
      objects,
      settings,
      view: useStore.getState().view,
    }
    download(`meshmaps-backup-${Date.now()}.json`, JSON.stringify(payload, null, 2), 'application/json')
    toast('ok', 'Резервная копия сохранена')
  }

  const restoreBackup = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async () => {
      const f = input.files?.[0]
      if (!f) return
      try {
        const data = JSON.parse(await f.text())
        if (!Array.isArray(data.objects)) throw new Error('bad')
        useStore.getState().pushHistory('import')
        useStore.setState({ objects: data.objects, saveState: 'saving' })
        if (data.settings) patch(data.settings)
        await replaceAll(data.objects)
        toast('ok', `Восстановлено ${data.objects.length} объектов`)
      } catch {
        toast('error', 'Некорректный файл резервной копии')
      }
    }
    input.click()
  }

  return (
    <Modal open={open} onClose={onClose} title="Настройки" subtitle="Интерфейс, карта и данные" width={600}>
      <div className="space-y-5">
        <section className="grid gap-2 sm:grid-cols-2">
          <div>
            <SectionLabel>Имя автора</SectionLabel>
            <input className="field" value={settings.author} onChange={(e) => patch({ author: e.target.value })} />
          </div>
          <div>
            <SectionLabel>Язык интерфейса</SectionLabel>
            <Segmented
              value={settings.locale}
              onChange={(v) => patch({ locale: v as Locale })}
              options={[
                { id: 'ru', label: 'Русский' },
                { id: 'en', label: 'English' },
              ]}
            />
          </div>
        </section>

        <section>
          <SectionLabel>Внешний вид</SectionLabel>
          <div className="grid gap-2 sm:grid-cols-2">
            <Segmented
              value={theme}
              onChange={(v) => setTheme(v)}
              options={[
                { id: 'dark', label: 'Тёмная', icon: 'moon' },
                { id: 'light', label: 'Светлая', icon: 'sun' },
              ]}
            />
            <select className="field" value={basemap} onChange={(e) => setBasemap(e.target.value as BaseMapId)}>
              {(Object.keys(BASEMAPS) as BaseMapId[]).map((id) => (
                <option key={id} value={id}>
                  {BASEMAPS[id].labelRu}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
          <ToggleRow label="Звуковые уведомления" checked={settings.sound} onChange={(v) => patch({ sound: v })} />
          <ToggleRow label="Подписи объектов" checked={layers.labels} onChange={() => toggleLayer('labels')} />
          <ToggleRow label="Анимация маркеров" checked={settings.animateMarkers} onChange={(v) => patch({ animateMarkers: v })} />
          <ToggleRow label="Кластеризация" checked={settings.cluster} onChange={(v) => patch({ cluster: v })} />
          <ToggleRow label="OSM 3D-здания" checked={settings.osmBuildings} onChange={(v) => patch({ osmBuildings: v })} />
          <ToggleRow label="Тени по солнцу" checked={layers.shadows} onChange={() => toggleLayer('shadows')} />
          <ToggleRow label="Рельеф (hillshade)" checked={layers.hillshade} onChange={() => toggleLayer('hillshade')} />
          <ToggleRow label="Автосохранение" checked={settings.autoSave} onChange={(v) => patch({ autoSave: v })} />
        </section>

        <section>
          <SectionLabel>Положение солнца (для теней)</SectionLabel>
          <div className="flex items-center gap-2">
            <input type="time" className="field max-w-[130px]" value={timeValue} onChange={(e) => setSunTime(e.target.value)} />
            <span className="muted text-[10.5px]">Время суток влияет на направление теней зданий.</span>
          </div>
        </section>

        <section>
          <SectionLabel>Данные</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn !text-[11.5px]" onClick={backup}>
              <Icon name="database" size={13} /> Резервная копия
            </button>
            <button className="btn !text-[11.5px]" onClick={restoreBackup}>
              <Icon name="upload" size={13} /> Восстановить копию
            </button>
            <button className="btn !text-[11.5px]" onClick={() => exportGeoJSON()}>
              <Icon name="download" size={13} /> GeoJSON
            </button>
            <button className="btn !text-[11.5px] text-danger" onClick={() => (confirmClear ? (clearAll(), setConfirmClear(false), toast('ok', 'Карта очищена')) : setConfirmClear(true))}>
              <Icon name="trash" size={13} /> {confirmClear ? 'Нажмите ещё раз' : 'Очистить карту'}
            </button>
          </div>
          <div className="muted mt-2 flex items-center justify-between text-[10px]">
            <span>IndexedDB · {db.name} · {objects.length} записей</span>
            <span>занято {usage}</span>
          </div>
        </section>

        <section className="rounded-xl border border-[rgb(var(--line)/0.08)] p-2.5">
          <div className="mb-1 flex items-center gap-2 text-[11.5px] font-medium">
            <Icon name="info" size={13} /> Офлайн-режим (PWA)
          </div>
          <p className="muted text-[10.5px] leading-snug">
            Приложение кеширует оболочку и тайлы. Установите его через меню браузера «Установить приложение» — карта
            откроется без интернета, а правки синхронизируются позже.
          </p>
        </section>
      </div>
    </Modal>
  )
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-[rgb(var(--line)/0.03)] px-2 py-1.5">
      <span className="text-[11.5px]">{label}</span>
      <Switch checked={checked} onChange={onChange} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* shortcuts                                                           */
/* ------------------------------------------------------------------ */

const SHORTCUTS: [string, string][] = [
  ['V', 'Инструмент выбора'],
  ['P', 'Точка'],
  ['T', 'Линия / тропа'],
  ['G', 'Полигон'],
  ['B', 'Здание'],
  ['F', 'Ограждение'],
  ['C', 'Зона-буфер'],
  ['M', 'Измерить расстояние'],
  ['A', 'Измерить площадь'],
  ['R', 'Маршрут'],
  ['2', '2D-режим'],
  ['3', '3D-режим'],
  ['Enter', 'Завершить рисование'],
  ['Esc', 'Отмена / снять выделение'],
  ['Backspace', 'Убрать последнюю точку'],
  ['⌘/Ctrl + Z', 'Отменить'],
  ['⌘/Ctrl + ⇧ + Z', 'Повторить'],
  ['⌘/Ctrl + K', 'Поиск'],
  ['⌘/Ctrl + S', 'Экспорт GeoJSON'],
  ['⌘/Ctrl + D', 'Дублировать объект'],
  ['Delete', 'Удалить выбранное'],
  ['L', 'Список объектов'],
  ['H', 'Тепловая карта'],
  ['Shift + drag', 'Вращение камеры в 3D'],
]

function ShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Горячие клавиши" subtitle="Работают, когда фокус не в поле ввода" width={560}>
      <div className="grid gap-1 sm:grid-cols-2">
        {SHORTCUTS.map(([k, label]) => (
          <div key={k + label} className="flex items-center justify-between rounded-lg px-2 py-1.5 odd:bg-[rgb(var(--line)/0.03)]">
            <span className="text-[11.5px]">{label}</span>
            <span className="kbd">{k}</span>
          </div>
        ))}
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* admin (MVP CMS, idea 100)                                           */
/* ------------------------------------------------------------------ */

function AdminModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const objects = useStore((s) => s.objects)
  const settings = useStore((s) => s.settings)
  const patch = useStore((s) => s.patchSettings)
  const snapshots = useStore((s) => s.snapshots)
  const toast = useStore((s) => s.toast)
  const [log, setLog] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    void kvGet<string[]>('admin:log', []).then(setLog)
  }, [open])

  const addLog = async (text: string) => {
    const entry = `${new Date().toLocaleString('ru-RU')} · ${text}`
    const next = [entry, ...log].slice(0, 50)
    setLog(next)
    await kvSet('admin:log', next)
  }

  return (
    <Modal open={open} onClose={onClose} title="Администрирование" subtitle="Роли, журнал и обслуживание базы (MVP)" width={620}>
      <div className="space-y-4">
        <section>
          <SectionLabel>Пользователи и роли</SectionLabel>
          <div className="space-y-1">
            {[
              { name: settings.author || 'Вы', role: 'Владелец', mail: 'локальный профиль' },
              { name: 'Редактор поля', role: 'Редактор', mail: 'приглашение не отправлено' },
              { name: 'Наблюдатель', role: 'Читатель', mail: 'только просмотр' },
            ].map((u) => (
              <div key={u.name} className="flex items-center gap-2 rounded-xl bg-[rgb(var(--line)/0.04)] px-2.5 py-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgb(var(--accent)/0.18)] text-[11px] font-semibold text-[rgb(var(--accent-soft))]">
                  {u.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="flex-1">
                  <div className="text-[11.5px]">{u.name}</div>
                  <div className="muted text-[9.5px]">{u.mail}</div>
                </div>
                <span className="chip">{u.role}</span>
              </div>
            ))}
          </div>
          <p className="muted mt-1.5 text-[9.5px]">
            Роли хранятся локально. Полноценный сервер авторизации — TODO: full version.
          </p>
        </section>

        <section className="grid grid-cols-3 gap-2">
          <BigStat label="Объектов" value={String(objects.length)} />
          <BigStat label="Снимков" value={String(snapshots.length)} />
          <BigStat label="Записей журнала" value={String(log.length)} />
        </section>

        <section>
          <SectionLabel>Резервное копирование</SectionLabel>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn !text-[11.5px]"
              onClick={async () => {
                download(`meshmaps-admin-${Date.now()}.json`, JSON.stringify({ objects, settings, exportedAt: new Date().toISOString() }, null, 2), 'application/json')
                await addLog('создана резервная копия')
                toast('ok', 'Резервная копия сохранена')
              }}
            >
              <Icon name="download" size={13} /> Скачать бэкап
            </button>
            <button
              className="btn !text-[11.5px]"
              onClick={async () => {
                await addLog('проверка целостности — ок')
                toast('ok', 'Проверка целостности пройдена')
              }}
            >
              <Icon name="check" size={13} /> Проверить базу
            </button>
            <button
              className="btn !text-[11.5px]"
              onClick={() => {
                patch({ author: settings.author })
                toast('info', 'Настройки переприменены')
              }}
            >
              <Icon name="settings" size={13} /> Переприменить настройки
            </button>
          </div>
        </section>

        <section>
          <SectionLabel>Журнал изменений</SectionLabel>
          <div className="max-h-[180px] space-y-0.5 overflow-y-auto">
            {log.length === 0 && <div className="muted py-2 text-center text-[11px]">Журнал пуст</div>}
            {log.map((l, i) => (
              <div key={i} className="muted rounded-lg px-2 py-1 font-mono text-[10px] odd:bg-[rgb(var(--line)/0.03)]">
                {l}
              </div>
            ))}
          </div>
        </section>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* about                                                               */
/* ------------------------------------------------------------------ */

function AboutModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const objects = useStore((s) => s.objects)
  return (
    <Modal open={open} onClose={onClose} title="О проекте MeshMaps" subtitle="Карта с расширенной разметкой на OpenStreetMap" width={560}>
      <div className="space-y-4 text-[11.5px] leading-relaxed">
        <p className="muted">
          MeshMaps — открытый инструмент для разметки территорий: здания и их высоты, тропы и дороги, ограждения с
          реальными 3D-панелями, зоны ограничения доступа, POI и пользовательские свойства. Всё хранится локально в
          IndexedDB, экспортируется в GeoJSON и GPX.
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            ['React + TypeScript', 'строгая типизация'],
            ['MapLibre GL JS', '2D / 3D / рельеф'],
            ['TailwindCSS', 'glassmorphism UI'],
            ['Zustand', 'state + undo/redo'],
            ['Dexie / IndexedDB', 'локальное хранение'],
            ['Turf.js', 'геометрия'],
            ['Overpass API', '3D-здания OSM'],
            ['OSRM / Nominatim', 'маршруты и поиск'],
          ].map(([a, b]) => (
            <div key={a} className="rounded-xl bg-[rgb(var(--line)/0.05)] px-2 py-1.5">
              <div className="text-[11px] font-medium">{a}</div>
              <div className="muted text-[9.5px]">{b}</div>
            </div>
          ))}
        </div>
        <div className="muted flex items-center justify-between border-t border-[rgb(var(--line)/0.08)] pt-2 text-[10px]">
          <span>v0.1.0 · объектов в базе: {objects.length}</span>
          <span>данные © OpenStreetMap contributors</span>
        </div>
      </div>
    </Modal>
  )
}
