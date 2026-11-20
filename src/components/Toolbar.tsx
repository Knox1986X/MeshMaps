import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '@/store/useStore'
import type { ObjKind, ToolId } from '@/types'
import { CATEGORIES, FENCE_STYLES, FENCE_TYPES, PALETTE, ROOF_TYPES, TEMPLATES } from '@/icons/categories'
import { MapIcon } from '@/icons'
import { Icon } from './Icon'
import { ColorPicker, Popover, Segmented, Slider, Switch } from './ui'
import { createObject } from '@/store/useStore'

const TOOLS: { id: ToolId; icon: string; label: string; kbd: string }[] = [
  { id: 'select', icon: 'cursor', label: 'Выбор / свойства', kbd: 'V' },
  { id: 'point', icon: 'point', label: 'Точка', kbd: 'P' },
  { id: 'line', icon: 'line', label: 'Линия / тропа', kbd: 'T' },
  { id: 'polygon', icon: 'polygon', label: 'Полигон / территория', kbd: 'G' },
  { id: 'building', icon: 'building', label: 'Здание (3D)', kbd: 'B' },
  { id: 'fence', icon: 'fence', label: 'Оградить область', kbd: 'F' },
  { id: 'buffer', icon: 'buffer', label: 'Зона-буфер', kbd: 'C' },
  { id: 'measure-distance', icon: 'ruler', label: 'Измерить расстояние', kbd: 'M' },
  { id: 'measure-area', icon: 'area', label: 'Измерить площадь', kbd: 'A' },
  { id: 'route', icon: 'route', label: 'Маршрут', kbd: 'R' },
]

const KIND_TOOL: Record<string, ObjKind> = {
  point: 'point',
  line: 'line',
  polygon: 'polygon',
  building: 'building',
  fence: 'fence',
  buffer: 'point',
}

export function Toolbar() {
  const tool = useStore((s) => s.tool)
  const setTool = useStore((s) => s.setTool)
  const pending = useStore((s) => s.pending)
  const patchPending = useStore((s) => s.patchPending)
  const selectedId = useStore((s) => s.selectedId)
  const deleteSelected = useStore((s) => s.deleteSelected)
  const bottomOpen = useStore((s) => s.bottomOpen)
  const setBottomOpen = useStore((s) => s.setBottomOpen)
  const addObjects = useStore((s) => s.addObjects)
  const toast = useStore((s) => s.toast)
  const objects = useStore((s) => s.objects)

  const kind = KIND_TOOL[tool]
  const showOptions = !!kind && tool !== 'select'
  const cats = CATEGORIES.filter((c) => c.kind === kind || (kind === 'point' && c.kind === 'point'))

  const applyTemplate = (id: string) => {
    const t = TEMPLATES.find((x) => x.id === id)
    if (!t) return
    patchPending({ category: t.category, height: t.height ?? pending.height, buildingLevels: t.buildingLevels ?? pending.buildingLevels })
    setTool(t.type === 'polygon' ? 'polygon' : t.type)
    toast('info', `Шаблон «${t.labelRu}» выбран — нарисуйте на карте`)
  }

  const addTemplateHere = (id: string) => {
    const t = TEMPLATES.find((x) => x.id === id)
    if (!t) return
    const st = useStore.getState()
    const c = st.view.center
    const obj =
      t.type === 'point'
        ? createObject({ type: 'point', category: t.category, geometry: { type: 'Point', coordinates: c }, name: t.labelRu, properties: t.properties, height: t.height })
        : createObject({
            type: t.type,
            category: t.category,
            geometry:
              t.type === 'line'
                ? {
                    type: 'LineString',
                    coordinates: [
                      [c[0] - 0.0006, c[1] - 0.0004],
                      [c[0], c[1] + 0.0004],
                      [c[0] + 0.0006, c[1] - 0.0002],
                    ],
                  }
                : {
                    type: 'Polygon',
                    coordinates: [
                      [
                        [c[0] - 0.0007, c[1] - 0.0005],
                        [c[0] + 0.0007, c[1] - 0.0005],
                        [c[0] + 0.0007, c[1] + 0.0005],
                        [c[0] - 0.0007, c[1] + 0.0005],
                        [c[0] - 0.0007, c[1] - 0.0005],
                      ],
                    ],
                  },
            name: t.labelRu,
            properties: t.properties,
            height: t.height,
            buildingLevels: t.buildingLevels,
            roofType: t.roofType,
            fenceType: t.type === 'fence' ? 'fence' : undefined,
            fenceStyle: t.type === 'fence' ? 'mesh' : undefined,
          })
    addObjects([obj], 'template')
    useStore.getState().select(obj.id)
    toast('ok', 'Шаблон добавлен в центр карты')
  }

  return (
    <>
      <div className="pointer-events-none absolute left-2.5 top-[58px] z-30 flex flex-col gap-2 sm:left-3 sm:top-[66px]">
        <div className="panel tool-rail pointer-events-auto flex w-11 flex-col items-center gap-0.5 p-1">
          {TOOLS.slice(0, 7).map((t) => (
            <ToolButton key={t.id} {...t} active={tool === t.id} onClick={() => setTool(t.id)} />
          ))}
          <div className="my-1 h-px w-6 bg-[rgb(var(--line)/0.12)]" />
          {TOOLS.slice(7).map((t) => (
            <ToolButton key={t.id} {...t} active={tool === t.id} onClick={() => setTool(t.id)} />
          ))}
        </div>

        <div className="panel pointer-events-auto flex w-11 flex-col items-center gap-0.5 p-1">
          <Popover
            width={252}
            align="left"
            label="Шаблоны объектов"
            trigger={(open, toggle) => (
              <button className="tool-btn h-9 w-9" data-active={open} onClick={toggle} title="Шаблоны объектов">
                <Icon name="sparkles" size={16} />
              </button>
            )}
          >
            {(close) => (
              <div>
                <div className="muted px-2 pb-1 pt-1 text-[9.5px] font-semibold uppercase tracking-wider">
                  Шаблоны объектов
                </div>
                {TEMPLATES.map((t) => (
                  <div key={t.id} className="flex items-center gap-1 rounded-lg px-1 hover:bg-[rgb(var(--line)/0.08)]">
                    <button
                      onClick={() => {
                        applyTemplate(t.id)
                        close()
                      }}
                      className="flex-1 py-1.5 text-left text-[11.5px]"
                    >
                      {t.labelRu}
                    </button>
                    <button
                      onClick={() => {
                        addTemplateHere(t.id)
                        close()
                      }}
                      className="muted rounded-md px-1.5 py-1 text-[10px] hover:text-[rgb(var(--accent-soft))]"
                      title="Добавить в центр карты"
                    >
                      <Icon name="plus" size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Popover>
          <button
            className="tool-btn h-9 w-9"
            data-active={bottomOpen}
            onClick={() => setBottomOpen(!bottomOpen)}
            title="Список объектов"
          >
            <Icon name="list" size={16} />
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[rgb(var(--accent))] px-1 text-[9px] font-semibold text-white">
              {objects.length}
            </span>
          </button>
          <button
            className="tool-btn h-9 w-9 disabled:opacity-30"
            disabled={!selectedId}
            onClick={deleteSelected}
            title="Удалить выбранный объект (Del)"
          >
            <Icon name="trash" size={16} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showOptions && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-auto absolute left-[58px] top-[58px] z-20 hidden w-[248px] sm:left-[62px] sm:top-[66px] md:block"
          >
            <div className="panel max-h-[calc(100vh-170px)] overflow-y-auto p-2.5">
              <div className="muted mb-1.5 flex items-center justify-between text-[9.5px] font-semibold uppercase tracking-wider">
                <span>Что рисуем</span>
                <button className="muted hover:text-[rgb(var(--text))]" onClick={() => setTool('select')} title="Отменить">
                  <Icon name="close" size={12} />
                </button>
              </div>
              <div className="mb-2 grid grid-cols-4 gap-1">
                {cats.slice(0, 12).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => patchPending({ category: c.id, color: c.color })}
                    title={c.labelRu}
                    className={`flex flex-col items-center gap-1 rounded-xl px-1 py-1.5 transition-colors ${
                      pending.category === c.id ? 'bg-[rgb(var(--accent)/0.16)] ring-1 ring-[rgb(var(--accent)/0.4)]' : 'hover:bg-[rgb(var(--line)/0.07)]'
                    }`}
                  >
                    <MapIcon glyph={c.icon} color={c.color} size={20} />
                    <span className="line-clamp-1 text-[8.5px] leading-tight opacity-80">{c.labelRu.split(' ')[0]}</span>
                  </button>
                ))}
              </div>

              <div className="mb-2">
                <div className="muted mb-1 text-[10px]">Цвет объекта</div>
                <ColorPicker
                  palette={PALETTE}
                  value={pending.color ?? CATEGORIES.find((c) => c.id === pending.category)?.color ?? '#4f8cff'}
                  onChange={(c) => patchPending({ color: c })}
                />
              </div>

              {tool === 'line' && (
                <div className="space-y-2">
                  <Segmented
                    size="sm"
                    value={pending.lineStyle}
                    onChange={(v) => patchPending({ lineStyle: v })}
                    options={[
                      { id: 'solid', label: 'Сплошная' },
                      { id: 'dashed', label: 'Пунктир' },
                    ]}
                  />
                  <p className="muted text-[10px] leading-snug">Клик — точка изгиба, Enter — завершить.</p>
                </div>
              )}

              {(tool === 'building' || tool === 'fence') && (
                <div className="space-y-2.5">
                  <Slider
                    label="Высота"
                    suffix=" м"
                    min={tool === 'fence' ? 0.5 : 2}
                    max={tool === 'fence' ? 8 : 80}
                    step={0.5}
                    value={pending.height}
                    onChange={(v) => patchPending({ height: v })}
                  />
                  {tool === 'building' && (
                    <>
                      <Slider
                        label="Этажей"
                        min={1}
                        max={25}
                        value={pending.buildingLevels}
                        onChange={(v) => patchPending({ buildingLevels: v, height: Math.round(v * 3.1) })}
                      />
                      <div>
                        <div className="muted mb-1 text-[10px]">Тип крыши</div>
                        <div className="grid grid-cols-2 gap-1">
                          {ROOF_TYPES.map((r) => (
                            <button
                              key={r.id}
                              className="chip justify-center"
                              onClick={() => {
                                const st = useStore.getState()
                                if (st.selectedId) st.updateObject(st.selectedId, { roofType: r.id })
                              }}
                            >
                              {r.labelRu}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                  {tool === 'fence' && (
                    <>
                      <div>
                        <div className="muted mb-1 text-[10px]">Тип ограждения</div>
                        <div className="grid grid-cols-2 gap-1">
                          {FENCE_TYPES.map((f) => (
                            <button
                              key={f.id}
                              onClick={() => patchPending({ fenceType: f.id, color: f.color })}
                              className={`flex items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-left text-[10px] transition-colors ${
                                pending.fenceType === f.id ? 'bg-[rgb(var(--accent)/0.16)] ring-1 ring-[rgb(var(--accent)/0.4)]' : 'hover:bg-[rgb(var(--line)/0.07)]'
                              }`}
                            >
                              <MapIcon glyph={f.icon} color={f.color} size={15} />
                              <span className="leading-tight">{f.labelRu}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="muted mb-1 text-[10px]">Материал</div>
                        <div className="flex flex-wrap gap-1">
                          {FENCE_STYLES.map((s) => (
                            <button
                              key={s.id}
                              onClick={() => patchPending({ fenceStyle: s.id })}
                              className={`chip ${pending.fenceStyle === s.id ? 'chip-active' : ''}`}
                            >
                              {s.labelRu}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {tool === 'point' && (
                <div className="space-y-2">
                  <Slider
                    label="Буфер вокруг точки"
                    suffix=" м"
                    min={0}
                    max={800}
                    step={10}
                    value={pending.radius}
                    onChange={(v) => patchPending({ radius: v })}
                  />
                  <p className="muted text-[10px] leading-snug">Кликайте по карте — точки добавляются подряд.</p>
                </div>
              )}
              {tool === 'buffer' && (
                <p className="muted text-[10px] leading-snug">Клик по карте создаёт зону радиусом 180 м (настраивается в свойствах).</p>
              )}
              {tool === 'polygon' && (
                <p className="muted text-[10px] leading-snug">Клик — вершины, Enter — замкнуть полигон.</p>
              )}
              {tool === 'route' && (
                <p className="muted text-[10px] leading-snug">
                  Клик — точки маршрута. Профиль переключается в нижней панели.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function ToolButton({
  id,
  icon,
  label,
  kbd,
  active,
  onClick,
}: {
  id: ToolId
  icon: string
  label: string
  kbd: string
  active: boolean
  onClick: () => void
}) {
  return (
    <div className="group relative">
      <button className="tool-btn h-9 w-9" data-active={active} onClick={onClick} aria-label={label}>
        <Icon name={icon} size={16} />
      </button>
      <div className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-40 hidden -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-lg border border-[rgb(var(--line)/0.12)] bg-[rgb(var(--glass-strong)/0.96)] px-2 py-1 shadow-float group-hover:flex">
        <span className="text-[11px]">{label}</span>
        <span className="kbd">{kbd}</span>
      </div>
    </div>
  )
}
