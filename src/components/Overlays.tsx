import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '@/store/useStore'
import { useDrawing } from '@/hooks/useDrawing'
import { bearing, formatArea, formatDistance } from '@/utils/geo'
import { Icon } from './Icon'
import { Segmented } from './ui'
import { createObject } from '@/store/useStore'

const LABEL: Record<string, string> = {
  point: 'Точка',
  line: 'Линия / тропа',
  polygon: 'Полигон / территория',
  building: 'Здание',
  fence: 'Ограждение территории',
  'measure-distance': 'Измерение расстояния',
  'measure-area': 'Измерение площади',
  route: 'Маршрут',
}

export function DraftBar() {
  const tool = useStore((s) => s.tool)
  const draft = useStore((s) => s.draft)
  const measure = useStore((s) => s.measure)
  const route = useStore((s) => s.route)
  const bottomOpen = useStore((s) => s.bottomOpen)
  const setTool = useStore((s) => s.setTool)
  const setRouteProfile = useStore((s) => s.setRouteProfile)
  const setRoutePoints = useStore((s) => s.setRoutePoints)
  const setRouteResult = useStore((s) => s.setRouteResult)
  const setMeasurePoints = useStore((s) => s.setMeasurePoints)
  const addObjects = useStore((s) => s.addObjects)
  const toast = useStore((s) => s.toast)
  const { finish, cancel, undoPoint } = useDrawing()

  const active = tool !== 'select'
  const points =
    tool === 'measure-distance' || tool === 'measure-area'
      ? measure.points.length
      : tool === 'route'
        ? route.points.length
        : (draft?.coords.length ?? 0)

  const canFinish = (() => {
    if (tool === 'line') return points >= 2
    if (tool === 'polygon' || tool === 'building' || tool === 'fence') return points >= 3
    if (tool === 'measure-distance') return points >= 2
    if (tool === 'measure-area') return points >= 3
    if (tool === 'route') return points >= 2
    return false
  })()

  const saveRoute = () => {
    const r = useStore.getState().route
    if (!r.result) return
    const obj = createObject({
      type: 'line',
      category: 'route',
      name: `Маршрут ${(r.result.distance / 1000).toFixed(2)} км`,
      geometry: { type: 'LineString', coordinates: r.result.coordinates },
      properties: {
        профиль: r.profile,
        длина: Math.round(r.result.distance),
        время: Math.round(r.result.duration / 60),
      },
      color: '#4f8cff',
      icon: 'route',
    })
    addObjects([obj], 'route')
    toast('ok', 'Маршрут сохранён как объект')
    setTool('select')
    setRoutePoints([])
    setRouteResult(null)
  }

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 18 }}
          transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
          className="pointer-events-none absolute left-1/2 z-40 w-[min(560px,calc(100vw-160px))] -translate-x-1/2"
          style={{ bottom: bottomOpen ? 'calc(min(46vh, 380px) + 20px)' : 14 }}
        >
          <div className="panel pointer-events-auto flex flex-wrap items-center gap-2 px-2.5 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[rgb(var(--accent)/0.16)] text-[rgb(var(--accent-soft))]">
                <Icon name={tool === 'route' ? 'route' : tool.startsWith('measure') ? 'ruler' : tool === 'fence' ? 'fence' : tool === 'building' ? 'building' : tool === 'polygon' ? 'polygon' : tool === 'line' ? 'line' : 'point'} size={14} />
              </span>
              <div className="min-w-0">
                <div className="truncate text-[12px] font-semibold leading-tight">
                  {LABEL[tool] ?? tool} <span className="muted font-normal">· {points}</span>
                </div>
                <div className="muted truncate text-[10px]">
                  {tool === 'point'
                    ? 'Кликайте по карте — точки добавляются подряд'
                    : tool === 'route'
                      ? route.result
                        ? `${formatDistance(route.result.distance)} · ${Math.round(route.result.duration / 60)} мин`
                        : 'Кликните начальную и конечную точки'
                      : tool === 'measure-distance'
                        ? `Длина: ${formatDistance(measure.result?.distance ?? 0)}${
                            measure.points.length > 1
                              ? ` · азимут ${Math.round(
                                  bearing(
                                    measure.points[measure.points.length - 2],
                                    measure.points[measure.points.length - 1],
                                  ),
                                )}°`
                              : ''
                          }`
                        : tool === 'measure-area'
                          ? `Площадь: ${formatArea(measure.result?.area ?? 0)} · периметр ${formatDistance(measure.result?.distance ?? 0)}`
                          : 'Клик — вершина · Enter — готово · Esc — отмена'}
                </div>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-1">
              {tool === 'route' && (
                <Segmented
                  size="sm"
                  value={route.profile}
                  onChange={setRouteProfile}
                  options={[
                    { id: 'driving', label: '', icon: 'car' },
                    { id: 'walking', label: '', icon: 'walk' },
                    { id: 'cycling', label: '', icon: 'bike' },
                  ]}
                />
              )}
              {tool === 'route' && route.result && (
                <button className="btn !py-1.5 !text-[11px]" onClick={saveRoute}>
                  <Icon name="plus" size={12} /> Сохранить
                </button>
              )}
              {points > 0 && (
                <button className="btn !py-1.5 !text-[11px]" onClick={undoPoint} title="Убрать последнюю точку (Backspace)">
                  <Icon name="undo" size={12} />
                </button>
              )}
              {(tool === 'measure-distance' || tool === 'measure-area') && points > 0 && (
                <button className="btn !py-1.5 !text-[11px]" onClick={() => setMeasurePoints([])} title="Очистить">
                  <Icon name="trash" size={12} />
                </button>
              )}
              {tool === 'route' && points > 0 && (
                <button
                  className="btn !py-1.5 !text-[11px]"
                  onClick={() => {
                    setRoutePoints([])
                    setRouteResult(null)
                  }}
                  title="Очистить маршрут"
                >
                  <Icon name="trash" size={12} />
                </button>
              )}
              <button className="btn !py-1.5 !text-[11px]" onClick={cancel} title="Отмена (Esc)">
                <Icon name="close" size={12} />
              </button>
              {!['measure-distance', 'measure-area', 'route', 'point', 'buffer'].includes(tool) && (
                <button className="btn btn-primary !py-1.5 !text-[11px]" disabled={!canFinish} onClick={() => finish()}>
                  <Icon name="check" size={12} /> Готово
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts)
  const dismiss = useStore((s) => s.dismissToast)
  const colors: Record<string, string> = {
    ok: 'var(--ok)',
    info: 'var(--accent)',
    warn: 'var(--warn)',
    error: 'var(--danger)',
  }
  return (
    <div className="pointer-events-none absolute bottom-[96px] left-2.5 z-[90] flex w-[min(300px,calc(100vw-24px))] flex-col gap-1.5">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: -20, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            onClick={() => dismiss(t.id)}
            className="panel-solid pointer-events-auto flex cursor-pointer items-start gap-2 px-3 py-2"
          >
            <span
              className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: `rgb(${colors[t.kind]})` }}
            />
            <span className="text-[11.5px] leading-snug">{t.text}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export function EmptyHint() {
  const objects = useStore((s) => s.objects)
  const hydrated = useStore((s) => s.hydrated)
  const [dismissed, setDismissed] = useState(false)
  if (objects.length > 0 || !hydrated || dismissed) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="pointer-events-none absolute left-1/2 top-[calc(50%-40px)] z-20 w-[min(360px,80vw)] -translate-x-1/2 text-center"
    >
      <div className="panel pointer-events-auto p-4">
        <div className="mb-1 text-[13px] font-semibold">Карта пуста — начните разметку</div>
        <p className="muted mb-2 text-[11.5px] leading-snug">
          Выберите инструмент слева: точку, тропу, здание или ограждение. Всё сохраняется в IndexedDB автоматически.
        </p>
        <div className="muted flex flex-wrap justify-center gap-1 text-[10px]">
          <span className="kbd">P</span> точка
          <span className="kbd">T</span> тропа
          <span className="kbd">B</span> здание
          <span className="kbd">F</span> забор
          <span className="kbd">3</span> 3D
        </div>
        <button className="btn mt-2.5 !py-1 !text-[10.5px]" onClick={() => setDismissed(true)}>
          Понятно
        </button>
      </div>
    </motion.div>
  )
}
