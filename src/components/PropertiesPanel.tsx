import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import maplibregl from 'maplibre-gl'
import { bbox as turfBbox, booleanPointInPolygon, point as turfPoint } from '@turf/turf'
import QRCode from 'qrcode'
import { createObject, useStore } from '@/store/useStore'
import type { MapObject, Polygon, PropertyValue } from '@/types'
import { CATEGORIES, FENCE_STYLES, FENCE_TYPES, PALETTE, ROOF_TYPES, getCategory } from '@/icons/categories'
import { GLYPHS, MapIcon } from '@/icons'
import { Icon } from './Icon'
import { ColorPicker, Segmented, Slider, Switch } from './ui'
import { fetchElevationProfile, reverseGeocode } from '@/api'
import { mapRegistry } from '@/map/registry'
import {
  centroidOf,
  formatArea,
  formatCoords,
  formatDistance,
  formatDms,
  geometryArea,
  geometryLength,
  haversine,
} from '@/utils/geo'
import { buildShareUrl } from '@/utils/share'

type Tab = 'props' | 'geom' | 'data'

const GLYPH_LIST = Object.keys(GLYPHS)

export function PropertiesPanel() {
  const selectedId = useStore((s) => s.selectedId)
  const objects = useStore((s) => s.objects)
  const select = useStore((s) => s.select)
  const update = useStore((s) => s.updateObject)
  const pushHistory = useStore((s) => s.pushHistory)
  const remove = useStore((s) => s.deleteObject)
  const duplicate = useStore((s) => s.duplicateObject)
  const requestFlyTo = useStore((s) => s.requestFlyTo)
  const toast = useStore((s) => s.toast)
  const [tab, setTab] = useState<Tab>('props')

  const obj = useMemo(() => objects.find((o) => o.id === selectedId) ?? null, [objects, selectedId])

  useEffect(() => {
    if (obj) setTab('props')
  }, [obj?.id])

  return (
    <AnimatePresence>
      {obj && (
        <motion.aside
          key="props"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ duration: 0.24, ease: [0.22, 0.61, 0.36, 1] }}
          className="pointer-events-auto absolute bottom-3 right-2.5 top-[58px] z-30 w-[min(360px,calc(100vw-16px))] sm:right-3 sm:top-[66px]"
        >
          <div className="panel flex h-full flex-col overflow-hidden">
            <PropertiesHeader
              obj={obj}
              onClose={() => select(null)}
              onDelete={() => remove(obj.id)}
              onDuplicate={() => duplicate(obj.id)}
              onPin={() => update(obj.id, { pinned: !obj.pinned })}
              onFly={() => requestFlyTo(centroidOf(obj.geometry), 18)}
            />
            <div className="px-2.5 pb-2">
              <Segmented
                size="sm"
                value={tab}
                onChange={setTab}
                options={[
                  { id: 'props', label: 'Свойства', icon: 'pen' },
                  { id: 'geom', label: 'Геометрия', icon: 'ruler' },
                  { id: 'data', label: 'Данные', icon: 'database' },
                ]}
              />
            </div>
            <div className="scroll-fade flex-1 overflow-y-auto px-3 pb-4">
              {tab === 'props' && <PropsTab obj={obj} />}
              {tab === 'geom' && <GeomTab obj={obj} />}
              {tab === 'data' && <DataTab obj={obj} />}
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )

}

function PropertiesHeader({
  obj,
  onClose,
  onDelete,
  onDuplicate,
  onPin,
  onFly,
}: {
  obj: MapObject
  onClose: () => void
  onDelete: () => void
  onDuplicate: () => void
  onPin: () => void
  onFly: () => void
}) {
  const update = useStore((s) => s.updateObject)
  const pushHistory = useStore((s) => s.pushHistory)
  const toast = useStore((s) => s.toast)
  const requestFlyTo = useStore((s) => s.requestFlyTo)
  const [name, setName] = useState(obj.name)
  useEffect(() => setName(obj.name), [obj.id])
  const cat = getCategory(obj.category)
  return (
    <div className="px-3 pb-2 pt-3">
      <div className="flex items-start gap-2.5">
        <MapIcon glyph={obj.icon || cat.icon} color={obj.color} size={30} />
        <div className="min-w-0 flex-1">
          <input
            value={name}
            placeholder="Без названия"
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name !== obj.name && update(obj.id, { name })}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="w-full bg-transparent text-[13.5px] font-semibold tracking-tight outline-none placeholder:text-[rgb(var(--muted))]"
          />
          <div className="muted mt-0.5 flex items-center gap-1.5 text-[10.5px]">
            <span>{cat.labelRu}</span>
            <span>·</span>
            <span className="font-mono">{obj.type}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center">
          <HeaderBtn icon="pin" label="Закрепить" active={obj.pinned} onClick={onPin} />
          <HeaderBtn icon="target" label="Приблизить" onClick={onFly} />
          <HeaderBtn icon="copy" label="Дублировать" onClick={onDuplicate} />
          <HeaderBtn icon="close" label="Закрыть" onClick={onClose} />
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <button onClick={onDelete} className="chip !text-danger hover:!bg-[rgb(var(--danger)/0.12)]">
          <Icon name="trash" size={11} /> Удалить
        </button>
        <button
          onClick={async () => {
            const url = buildShareUrl({
              view: useStore.getState().view,
              mode: useStore.getState().mode,
              theme: useStore.getState().theme,
              basemap: useStore.getState().basemap,
              selectedId: obj.id,
            })
            try {
              await navigator.clipboard.writeText(url)
              toast('ok', 'Ссылка на объект скопирована')
            } catch {
              toast('warn', url)
            }
          }}
          className="chip"
        >
          <Icon name="share" size={11} /> Ссылка
        </button>
        <span className="muted ml-auto font-mono text-[9.5px]">
          {new Date(obj.updatedAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}

function PropsTab({ obj }: { obj: MapObject }) {
  const update = useStore((s) => s.updateObject)
  const pushHistory = useStore((s) => s.pushHistory)
  const toast = useStore((s) => s.toast)
  const requestFlyTo = useStore((s) => s.requestFlyTo)
  const [desc, setDesc] = useState(obj.description)
  const [iconOpen, setIconOpen] = useState(false)
  useEffect(() => setDesc(obj.description), [obj.id])
  const begin = () => pushHistory('edit')
  const cat = getCategory(obj.category)

  return (
    <div className="space-y-3 pt-1">
      <label className="block">
        <span className="muted mb-1 block text-[10px] font-medium uppercase tracking-wide">Описание</span>
        <textarea
          value={desc}
          rows={2}
          placeholder="Что здесь находится, доступ, заметки…"
          onChange={(e) => setDesc(e.target.value)}
          onBlur={() => desc !== obj.description && update(obj.id, { description: desc })}
          className="field resize-none"
        />
      </label>

      <div>
        <span className="muted mb-1 block text-[10px] font-medium uppercase tracking-wide">Категория</span>
        <div className="grid max-h-[132px] grid-cols-6 gap-1 overflow-y-auto pr-0.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              title={c.labelRu}
              onClick={() => update(obj.id, { category: c.id, icon: c.icon, color: c.color })}
              className={`flex items-center justify-center rounded-lg py-1.5 transition-colors ${
                obj.category === c.id ? 'bg-[rgb(var(--accent)/0.16)] ring-1 ring-[rgb(var(--accent)/0.4)]' : 'hover:bg-[rgb(var(--line)/0.07)]'
              }`}
            >
              <MapIcon glyph={c.icon} color={c.color} size={17} />
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="muted text-[10px] font-medium uppercase tracking-wide">Цвет</span>
          <button className="muted text-[10px] hover:text-[rgb(var(--text))]" onClick={() => setIconOpen((v) => !v)}>
            {iconOpen ? 'скрыть иконки' : 'сменить иконку'}
          </button>
        </div>
        <ColorPicker palette={PALETTE} value={obj.color} onChange={(c) => update(obj.id, { color: c })} />
        <AnimatePresence>
          {iconOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-2 flex items-center justify-between gap-1 rounded-lg bg-[rgb(var(--line)/0.05)] px-1.5 py-1">
                <span className="muted text-[9.5px]">{obj.customIcon ? 'свой SVG-маркер' : 'свой SVG-маркер'}</span>
                <div className="flex items-center gap-1">
                  {obj.customIcon && (
                    <>
                      <img src={obj.customIcon} alt="" className="h-5 w-5 object-contain" />
                      <button className="muted hover:text-danger" onClick={() => update(obj.id, { customIcon: undefined })}>
                        <Icon name="close" size={11} />
                      </button>
                    </>
                  )}
                  <label className="btn cursor-pointer !px-1.5 !py-0.5 !text-[9.5px]">
                    загрузить
                    <input
                      type="file"
                      accept=".svg,image/svg+xml,image/png"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (!f) return
                        const r = new FileReader()
                        r.onload = () => update(obj.id, { customIcon: String(r.result) })
                        r.readAsDataURL(f)
                      }}
                    />
                  </label>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-8 gap-1">
                {GLYPH_LIST.map((g) => (
                  <button
                    key={g}
                    title={g}
                    onClick={() => update(obj.id, { icon: g })}
                    className={`flex items-center justify-center rounded-md py-1 ${
                      obj.icon === g ? 'bg-[rgb(var(--accent)/0.2)] ring-1 ring-[rgb(var(--accent)/0.45)]' : 'hover:bg-[rgb(var(--line)/0.08)]'
                    }`}
                  >
                    <MapIcon glyph={g} color={obj.color} size={15} />
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="rounded-xl border border-[rgb(var(--line)/0.08)] p-2.5" onPointerDownCapture={() => pushHistory('edit')}>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-medium">Буфер / радиус</span>
          <span className="muted font-mono text-[10px]">{obj.radius ?? 0} м</span>
        </div>
        <input
          type="range"
          min={0}
          max={1500}
          step={10}
          value={obj.radius ?? 0}
          onPointerDown={begin}
          onChange={(e) => update(obj.id, { radius: Number(e.target.value) }, { silent: true })}
          className="w-full"
        />
        <p className="muted mt-1.5 text-[9.5px]">Кольцевая зона вокруг центроида объекта.</p>
      </div>

      {obj.type === 'building' && (
        <div
          className="space-y-2.5 rounded-xl border border-[rgb(var(--line)/0.08)] p-2.5"
          onPointerDownCapture={() => pushHistory('edit')}
        >
          <div className="text-[11px] font-medium">Параметры здания</div>
          <Slider
            label="Высота"
            suffix=" м"
            min={2}
            max={120}
            step={0.5}
            value={obj.height ?? 9}
            onChange={(v) => {
              if (!useStore.getState().history.past.length) begin()
              update(obj.id, { height: v, wallColor: obj.wallColor ?? obj.color }, { silent: true })
            }}
          />
          <Slider
            label="Этажей"
            min={1}
            max={40}
            value={obj.buildingLevels ?? Math.max(1, Math.round((obj.height ?? 9) / 3.1))}
            onChange={(v) => update(obj.id, { buildingLevels: v, height: Math.round(v * 3.1 * 10) / 10 }, { silent: true })}
          />
          <div>
            <div className="muted mb-1 text-[10px]">Тип крыши</div>
            <div className="grid grid-cols-4 gap-1">
              {ROOF_TYPES.map((r) => (
                <button
                  key={r.id}
                  onClick={() => update(obj.id, { roofType: r.id })}
                  className={`chip justify-center !px-1 ${obj.roofType === r.id ? 'chip-active' : ''}`}
                >
                  {r.labelRu}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="muted mb-1 text-[10px]">Цвет стен</div>
            <ColorPicker palette={PALETTE} value={obj.wallColor ?? obj.color} onChange={(c) => update(obj.id, { wallColor: c })} />
          </div>
        </div>
      )}

      {obj.type === 'fence' && (
        <div
          className="space-y-2.5 rounded-xl border border-[rgb(var(--line)/0.08)] p-2.5"
          onPointerDownCapture={() => pushHistory('edit')}
        >
          <div className="text-[11px] font-medium">Ограждение территории</div>
          <div className="grid grid-cols-2 gap-1">
            {FENCE_TYPES.map((f) => (
              <button
                key={f.id}
                onClick={() =>
                  update(obj.id, {
                    fenceType: f.id,
                    category: 'fence',
                    color: f.color,
                    icon: f.icon,
                  })
                }
                className={`flex items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-left text-[10px] transition-colors ${
                  obj.fenceType === f.id ? 'bg-[rgb(var(--accent)/0.16)] ring-1 ring-[rgb(var(--accent)/0.4)]' : 'hover:bg-[rgb(var(--line)/0.07)]'
                }`}
              >
                <MapIcon glyph={f.icon} color={f.color} size={14} />
                <span className="leading-tight">{f.labelRu}</span>
              </button>
            ))}
          </div>
          <div>
            <div className="muted mb-1 text-[10px]">Материал / тип</div>
            <div className="flex flex-wrap gap-1">
              {FENCE_STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => update(obj.id, { fenceStyle: s.id })}
                  className={`chip ${obj.fenceStyle === s.id ? 'chip-active' : ''}`}
                >
                  {s.labelRu}
                </button>
              ))}
            </div>
          </div>
          <Slider
            label="Высота забора"
            suffix=" м"
            min={0.5}
            max={8}
            step={0.1}
            value={obj.height ?? 2}
            onChange={(v) => update(obj.id, { height: v }, { silent: true })}
          />
          <Slider
            label="Прозрачность"
            suffix="%"
            min={20}
            max={100}
            value={Math.round((obj.fenceOpacity ?? 0.92) * 100)}
            onChange={(v) => update(obj.id, { fenceOpacity: v / 100 }, { silent: true })}
          />
        </div>
      )}

      {obj.type === 'line' && (
        <div className="space-y-2 rounded-xl border border-[rgb(var(--line)/0.08)] p-2.5">
          <div className="text-[11px] font-medium">Линия</div>
          <Segmented
            size="sm"
            value={obj.properties['стиль'] === 'dashed' ? 'dashed' : 'solid'}
            onChange={(v) => update(obj.id, { properties: { ...obj.properties, стиль: v } })}
            options={[
              { id: 'solid', label: 'Сплошная' },
              { id: 'dashed', label: 'Пунктир' },
            ]}
          />
          <TextField
            label="Покрытие"
            value={String(obj.properties['покрытие'] ?? '')}
            onCommit={(v) => update(obj.id, { properties: { ...obj.properties, покрытие: v } })}
          />
        </div>
      )}

      <div className="flex items-center justify-between rounded-xl border border-[rgb(var(--line)/0.08)] px-2.5 py-2">
        <span className="text-[11px]">Показывать поверх остальных</span>
        <Switch checked={!!obj.pinned} onChange={(v) => update(obj.id, { pinned: v })} />
      </div>

      <div className="muted flex flex-wrap items-center gap-1.5 pt-1 text-[9.5px]">
        <span>автор: {obj.author}</span>
        <span>·</span>
        <span>{cat.labelEn}</span>
      </div>
    </div>
  )
}

function GeomTab({ obj }: { obj: MapObject }) {
  const update = useStore((s) => s.updateObject)
  const pushHistory = useStore((s) => s.pushHistory)
  const toast = useStore((s) => s.toast)
  const requestFlyTo = useStore((s) => s.requestFlyTo)
  const center = centroidOf(obj.geometry)
  const pt = obj.geometry.type === 'Point' ? (obj.geometry.coordinates as [number, number]) : null
  const length = geometryLength(obj.geometry)
  const area = geometryArea(obj.geometry)
  const [profile, setProfile] = useState<{ distance: number; elevation: number }[] | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [animating, setAnimating] = useState(false)
  const markerRef = useRef<maplibregl.Marker | null>(null)

  const coords: [number, number][] =
    obj.geometry.type === 'LineString'
      ? (obj.geometry.coordinates as [number, number][])
      : obj.geometry.type === 'Polygon'
        ? (obj.geometry.coordinates[0] as [number, number][])
        : []

  const loadProfile = async () => {
    if (!coords.length) return
    setLoadingProfile(true)
    try {
      const p = await fetchElevationProfile(coords)
      if (!p.length) throw new Error('empty')
      setProfile(p)
    } catch {
      toast('warn', 'Сервис высот недоступен — попробуйте позже')
    } finally {
      setLoadingProfile(false)
    }
  }

  const animateAlong = () => {
    const map = mapRegistry.main
    if (!map || coords.length < 2) return
    setAnimating(true)
    const total = coords.reduce((s, c, i) => (i ? s + haversine(coords[i - 1], c) : 0), 0)
    const durations = Math.max(3500, Math.min(14000, total / 8))
    const el = document.createElement('div')
    el.style.cssText = 'width:26px;height:26px;filter:drop-shadow(0 4px 8px rgba(0,0,0,.5));transition:transform .1s'
    el.innerHTML = `<div style="width:26px;height:26px;border-radius:50%;background:${obj.color};border:2.5px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px">▶</div>`
    markerRef.current?.remove()
    const marker = new maplibregl.Marker({ element: el }).setLngLat(coords[0]).addTo(map)
    markerRef.current = marker
    const start = performance.now()
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / durations)
      const target = total * p
      let acc = 0
      let pos: [number, number] = coords[coords.length - 1]
      for (let i = 1; i < coords.length; i++) {
        const seg = haversine(coords[i - 1], coords[i])
        if (acc + seg >= target) {
          const k = seg === 0 ? 0 : (target - acc) / seg
          pos = [coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * k, coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * k]
          break
        }
        acc += seg
      }
      marker.setLngLat(pos)
      if (p < 1) requestAnimationFrame(step)
      else {
        setTimeout(() => {
          marker.remove()
          markerRef.current = null
          setAnimating(false)
        }, 700)
      }
    }
    requestAnimationFrame(step)
  }

  const scatterTrees = () => {
    if (obj.geometry.type !== 'Polygon') {
      toast('warn', 'Нужен полигон')
      return
    }
    const poly = obj.geometry as Polygon
    const b = turfBbox(poly)
    const created: MapObject[] = []
    let tries = 0
    while (created.length < 40 && tries < 1200) {
      tries++
      const p: [number, number] = [
        b[0] + Math.random() * (b[2] - b[0]),
        b[1] + Math.random() * (b[3] - b[1]),
      ]
      if (!booleanPointInPolygon(turfPoint(p), poly)) continue
      created.push(
        createObject({
          type: 'point',
          category: 'forest',
          icon: 'tree',
          color: '#16a34a',
          name: `Дерево ${created.length + 1}`,
          geometry: { type: 'Point', coordinates: p },
          tags: [...new Set([...obj.tags, 'деревья'])],
          properties: { 'высота, м': Number((6 + Math.random() * 11).toFixed(1)) },
        }),
      )
    }
    if (!created.length) {
      toast('warn', 'Не удалось разместить точки')
      return
    }
    useStore.getState().addObjects(created, 'scatter')
    toast('ok', `Добавлено ${created.length} деревьев`)
  }

  return (
    <div className="space-y-3 pt-1">
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Координаты" value={formatCoords(center[0], center[1])} mono />
        <Stat label="DMS" value={formatDms(center[0], center[1])} mono />
        <Stat label="Длина" value={length ? formatDistance(length) : '—'} />
        <Stat label="Площадь" value={area ? formatArea(area) : '—'} />
        <Stat label="Вершин" value={String(coords.length || 1)} />
        <Stat label="Тип" value={obj.geometry.type} mono />
      </div>

      {pt && (
        <div className="grid grid-cols-2 gap-2">
          <TextField
            label="Долгота"
            mono
            value={pt[0].toFixed(6)}
            onCommit={(v) => {
              const n = parseFloat(v)
              if (Number.isFinite(n)) update(obj.id, { geometry: { type: 'Point', coordinates: [n, pt[1]] } })
            }}
          />
          <TextField
            label="Широта"
            mono
            value={pt[1].toFixed(6)}
            onCommit={(v) => {
              const n = parseFloat(v)
              if (Number.isFinite(n)) update(obj.id, { geometry: { type: 'Point', coordinates: [pt[0], n] } })
            }}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        <button className="btn !py-1.5 !text-[11px]" onClick={() => requestFlyTo(center, 18)}>
          <Icon name="target" size={12} /> Приблизить
        </button>
        <button
          className="btn !py-1.5 !text-[11px]"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(`${center[1].toFixed(6)}, ${center[0].toFixed(6)}`)
              toast('ok', 'Координаты скопированы')
            } catch {
              toast('warn', formatCoords(center[0], center[1]))
            }
          }}
        >
          <Icon name="copy" size={12} /> Координаты
        </button>
        <button
          className="btn !py-1.5 !text-[11px]"
          onClick={async () => {
            const addr = await reverseGeocode(center[0], center[1])
            if (addr) {
              update(obj.id, { description: obj.description ? `${obj.description}\n${addr}` : addr })
              toast('ok', 'Адрес добавлен в описание')
            } else toast('warn', 'Адрес не найден')
          }}
        >
          <Icon name="globe" size={12} /> Адрес
        </button>
      </div>

      {area > 40 && (
        <div className="rounded-xl border border-[rgb(var(--line)/0.08)] p-2.5">
          <div className="mb-1.5 text-[11px] font-medium">Процедурное заполнение</div>
          <button className="btn w-full !py-1.5 !text-[11px]" onClick={scatterTrees}>
            <Icon name="tree" size={12} /> Засеять деревьями (40 точек)
          </button>
          <p className="muted mt-1 text-[9.5px]">Случайные точки-деревья внутри полигона — с тегом «деревья».</p>
        </div>
      )}

      {coords.length > 1 && (
        <div className="rounded-xl border border-[rgb(var(--line)/0.08)] p-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-medium">Профиль высоты</span>
            <button className="muted text-[10px] hover:text-[rgb(var(--text))]" onClick={loadProfile} disabled={loadingProfile}>
              {loadingProfile ? 'загрузка…' : 'загрузить'}
            </button>
          </div>
          {profile ? <ElevationChart data={profile} color={obj.color} /> : <p className="muted text-[9.5px]">Open-Elevation API · по линии объекта</p>}
          <button className="btn mt-2 w-full !py-1.5 !text-[11px]" onClick={animateAlong} disabled={animating}>
            <Icon name="walk" size={12} /> {animating ? 'Движение…' : 'Анимация по линии'}
          </button>
        </div>
      )}

      {obj.type === 'building' && (
        <div className="rounded-xl border border-[rgb(var(--line)/0.08)] p-2.5">
          <div className="mb-1.5 text-[11px] font-medium">Разрез здания</div>
          <Slider
            label="Срез по высоте"
            suffix=" м"
            min={0}
            max={Math.max(4, obj.height ?? 10)}
            step={0.5}
            value={0}
            onChange={(v) => {
              const map = mapRegistry.main
              if (map && map.getLayer('mm-building-3d')) {
                map.setPaintProperty('mm-building-3d', 'fill-extrusion-base', v)
              }
            }}
          />
          <p className="muted mt-1 text-[9.5px]">Сдвиньте, чтобы «срезать» здание.</p>
        </div>
      )}
    </div>
  )
}

function DataTab({ obj }: { obj: MapObject }) {
  const update = useStore((s) => s.updateObject)
  const pushHistory = useStore((s) => s.pushHistory)
  const toast = useStore((s) => s.toast)
  const requestFlyTo = useStore((s) => s.requestFlyTo)
  const [qr, setQr] = useState<string | null>(null)
  const [newKey, setNewKey] = useState('')
  const [newVal, setNewVal] = useState('')
  const [tag, setTag] = useState('')
  const [comment, setComment] = useState('')

  const setProp = (key: string, value: PropertyValue | null) => {
    const props = { ...obj.properties }
    if (value === null) delete props[key]
    else props[key] = value
    update(obj.id, { properties: props })
  }

  const makeQr = async () => {
    const url = buildShareUrl({
      view: useStore.getState().view,
      mode: useStore.getState().mode,
      theme: useStore.getState().theme,
      basemap: useStore.getState().basemap,
      selectedId: obj.id,
    })
    try {
      const data = await QRCode.toDataURL(url, { margin: 1, width: 220, color: { dark: '#0b0f16', light: '#ffffff' } })
      setQr(data)
    } catch {
      toast('error', 'Не удалось создать QR')
    }
  }

  return (
    <div className="space-y-3 pt-1">
      {/* custom properties */}
      <div className="rounded-xl border border-[rgb(var(--line)/0.08)] p-2.5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-medium">Пользовательские свойства</span>
          <span className="muted text-[9.5px]">{Object.keys(obj.properties).length}</span>
        </div>
        <div className="space-y-1">
          {Object.entries(obj.properties).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1">
              <span className="muted w-[42%] shrink-0 truncate text-[10.5px]">{k}</span>
              <input
                className="field !py-1 !text-[10.5px]"
                defaultValue={String(v)}
                onBlur={(e) => {
                  const val = e.target.value
                  const num = Number(val)
                  setProp(k, val.trim() !== '' && !Number.isNaN(num) ? num : val)
                }}
              />
              <button className="muted px-1 hover:text-danger" onClick={() => setProp(k, null)} title="Удалить">
                <Icon name="close" size={11} />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex items-center gap-1">
          <input className="field !py-1 !text-[10.5px]" placeholder="ключ" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
          <input className="field !py-1 !text-[10.5px]" placeholder="значение" value={newVal} onChange={(e) => setNewVal(e.target.value)} />
          <button
            className="btn !px-2 !py-1"
            onClick={() => {
              if (!newKey.trim()) return
              const num = Number(newVal)
              setProp(newKey.trim(), newVal.trim() !== '' && !Number.isNaN(num) ? num : newVal)
              setNewKey('')
              setNewVal('')
            }}
          >
            <Icon name="plus" size={12} />
          </button>
        </div>
      </div>

      {/* tags */}
      <div className="rounded-xl border border-[rgb(var(--line)/0.08)] p-2.5">
        <div className="mb-1.5 text-[11px] font-medium">Теги</div>
        <div className="flex flex-wrap gap-1">
          {obj.tags.map((t) => (
            <span key={t} className="chip">
              #{t}
              <button className="hover:text-danger" onClick={() => update(obj.id, { tags: obj.tags.filter((x) => x !== t) })}>
                <Icon name="close" size={9} />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-1.5 flex gap-1">
          <input
            className="field !py-1 !text-[10.5px]"
            placeholder="новый тег"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && tag.trim()) {
                update(obj.id, { tags: [...new Set([...obj.tags, tag.trim()])] })
                setTag('')
              }
            }}
          />
          <button
            className="btn !px-2 !py-1"
            onClick={() => {
              if (!tag.trim()) return
              update(obj.id, { tags: [...new Set([...obj.tags, tag.trim()])] })
              setTag('')
            }}
          >
            <Icon name="plus" size={12} />
          </button>
        </div>
      </div>

      {/* attachments */}
      <div className="rounded-xl border border-[rgb(var(--line)/0.08)] p-2.5">
        <div className="mb-1.5 text-[11px] font-medium">Фото и вложения</div>
        {obj.attachments.length > 0 && (
          <div className="mb-1.5 grid grid-cols-3 gap-1">
            {obj.attachments.map((a, i) => (
              <div key={i} className="group relative h-14 overflow-hidden rounded-lg bg-[rgb(var(--line)/0.06)]">
                <img src={a} alt="" className="h-full w-full object-cover" />
                <button
                  className="absolute right-0.5 top-0.5 hidden rounded bg-black/60 p-0.5 text-white group-hover:block"
                  onClick={() => update(obj.id, { attachments: obj.attachments.filter((_, j) => j !== i) })}
                >
                  <Icon name="close" size={9} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-1">
          <input
            className="field !py-1 !text-[10.5px]"
            placeholder="https://… (URL изображения)"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const url = (e.target as HTMLInputElement).value.trim()
                if (url) {
                  update(obj.id, { attachments: [...obj.attachments, url] })
                  ;(e.target as HTMLInputElement).value = ''
                }
              }
            }}
          />
          <label className="btn cursor-pointer !px-2 !py-1" title="Загрузить файл">
            <Icon name="upload" size={12} />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (!f) return
                const r = new FileReader()
                r.onload = () => update(obj.id, { attachments: [...obj.attachments, String(r.result)] })
                r.readAsDataURL(f)
              }}
            />
          </label>
        </div>
      </div>

      {/* rating + schedule */}
      <div className="rounded-xl border border-[rgb(var(--line)/0.08)] p-2.5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-medium">Рейтинг</span>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => update(obj.id, { rating: obj.rating === n ? undefined : n })}>
                <Icon
                  name="star"
                  size={14}
                  filled={!!obj.rating && n <= obj.rating}
                  className={obj.rating && n <= obj.rating ? 'text-amber' : 'muted'}
                />
              </button>
            ))}
          </div>
        </div>
        <div className="mb-1 text-[11px] font-medium">Расписание</div>
        <div className="space-y-1">
          {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => (
            <div key={d} className="flex items-center gap-1">
              <span className="muted w-6 text-[10px]">{d}</span>
              <input
                className="field !py-0.5 !text-[10px]"
                placeholder="09:00–18:00"
                defaultValue={obj.schedule?.[d] ?? ''}
                onBlur={(e) => update(obj.id, { schedule: { ...(obj.schedule ?? {}), [d]: e.target.value } })}
              />
            </div>
          ))}
        </div>
      </div>

      {/* comments */}
      <div className="rounded-xl border border-[rgb(var(--line)/0.08)] p-2.5">
        <div className="mb-1.5 text-[11px] font-medium">Комментарии</div>
        <div className="space-y-1.5">
          {(obj.comments ?? []).map((c) => (
            <div key={c.id} className="rounded-lg bg-[rgb(var(--line)/0.05)] px-2 py-1.5">
              <div className="muted flex items-center justify-between text-[9px]">
                <span>{c.author}</span>
                <span>{new Date(c.createdAt).toLocaleDateString('ru-RU')}</span>
              </div>
              <div className="text-[10.5px]">{c.text}</div>
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-1">
          <input
            className="field !py-1 !text-[10.5px]"
            placeholder="Добавить комментарий…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && comment.trim()) {
                const author = useStore.getState().settings.author
                update(obj.id, {
                  comments: [
                    ...(obj.comments ?? []),
                    { id: crypto.randomUUID().slice(0, 8), author, text: comment.trim(), createdAt: new Date().toISOString() },
                  ],
                })
                setComment('')
              }
            }}
          />
          <button
            className="btn !px-2 !py-1"
            onClick={() => {
              if (!comment.trim()) return
              const author = useStore.getState().settings.author
              update(obj.id, {
                comments: [
                  ...(obj.comments ?? []),
                  { id: crypto.randomUUID().slice(0, 8), author, text: comment.trim(), createdAt: new Date().toISOString() },
                ],
              })
              setComment('')
            }}
          >
            <Icon name="plus" size={12} />
          </button>
        </div>
      </div>

      {/* lifecycle + QR */}
      <div className="rounded-xl border border-[rgb(var(--line)/0.08)] p-2.5">
        <div className="mb-1.5 text-[11px] font-medium">Машина времени</div>
        <div className="grid grid-cols-2 gap-1.5">
          <TextField
            label="Год появления"
            mono
            value={String(obj.yearFrom ?? '')}
            onCommit={(v) => update(obj.id, { yearFrom: v ? Number(v) : undefined })}
          />
          <TextField
            label="Год исчезновения"
            mono
            value={String(obj.yearTo ?? '')}
            onCommit={(v) => update(obj.id, { yearTo: v ? Number(v) : undefined })}
          />
        </div>
        <button className="btn mt-2 w-full !py-1.5 !text-[11px]" onClick={makeQr}>
          <Icon name="qr" size={12} /> QR-код объекта
        </button>
        {qr && (
          <div className="mt-2 flex flex-col items-center gap-1">
            <img src={qr} alt="QR" className="h-[130px] w-[130px] rounded-lg" />
            <a href={qr} download={`meshmaps-${obj.id}.png`} className="muted text-[9.5px] underline">
              скачать
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

function HeaderBtn({ icon, label, onClick, active }: { icon: string; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`btn-ghost flex h-7 w-7 items-center justify-center ${
        active ? 'text-[rgb(var(--accent-soft))]' : 'muted hover:text-[rgb(var(--text))]'
      }`}
    >
      <Icon name={icon} size={14} />
    </button>
  )
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg bg-[rgb(var(--line)/0.05)] px-2 py-1.5">
      <div className="muted text-[9px] uppercase tracking-wide">{label}</div>
      <div className={`truncate text-[11px] ${mono ? 'font-mono' : ''}`} title={value}>
        {value}
      </div>
    </div>
  )
}

function TextField({
  label,
  value,
  onCommit,
  mono,
}: {
  label: string
  value: string
  onCommit: (v: string) => void
  mono?: boolean
}) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  return (
    <label className="block">
      <span className="muted mb-0.5 block text-[9.5px] uppercase tracking-wide">{label}</span>
      <input
        className={`field !py-1 !text-[10.5px] ${mono ? 'font-mono' : ''}`}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => v !== value && onCommit(v)}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    </label>
  )
}

function ElevationChart({ data, color }: { data: { distance: number; elevation: number }[]; color: string }) {
  const w = 300
  const h = 90
  const pad = 6
  const maxE = Math.max(...data.map((d) => d.elevation))
  const minE = Math.min(...data.map((d) => d.elevation))
  const maxD = data[data.length - 1]?.distance || 1
  const range = Math.max(1, maxE - minE)
  const pts = data.map((d) => {
    const x = pad + (d.distance / maxD) * (w - pad * 2)
    const y = h - pad - ((d.elevation - minE) / range) * (h - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const id = `grad-${color.replace('#', '')}`
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.45" />
            <stop offset="1" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon points={`${pad},${h - pad} ${pts.join(' ')} ${w - pad},${h - pad}`} fill={`url(#${id})`} />
        <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.6" />
      </svg>
      <div className="muted flex justify-between font-mono text-[9px]">
        <span>{Math.round(minE)} м</span>
        <span>{formatDistance(maxD)}</span>
        <span>{Math.round(maxE)} м</span>
      </div>
    </div>
  )
}
