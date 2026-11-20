import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore, objectStats, visibleObjects, type SortKey } from '@/store/useStore'
import { CATEGORIES, getCategory } from '@/icons/categories'
import { MapIcon } from '@/icons'
import { Icon } from './Icon'
import { Popover, Segmented, useCompactViewport } from './ui'
import {
  centroidOf,
  formatArea,
  formatDistance,
  geometryArea,
  geometryLength,
  haversine,
} from '@/utils/geo'

export function ObjectListPanel() {
  const compact = useCompactViewport()
  const open = useStore((s) => s.bottomOpen)
  const setOpen = useStore((s) => s.setBottomOpen)
  const objects = useStore((s) => s.objects)
  const filters = useStore((s) => s.filters)
  const setFilter = useStore((s) => s.setFilter)
  const toggleCategoryFilter = useStore((s) => s.toggleCategoryFilter)
  const sort = useStore((s) => s.sort)
  const setSort = useStore((s) => s.setSort)
  const selectedId = useStore((s) => s.selectedId)
  const select = useStore((s) => s.select)
  const requestFlyTo = useStore((s) => s.requestFlyTo)
  const update = useStore((s) => s.updateObject)
  const remove = useStore((s) => s.deleteObject)
  const viewCenter = useStore((s) => s.view.center)
  const [tab, setTab] = useState<'list' | 'stats'>('list')
  const [radiusFilter, setRadiusFilter] = useState(0)

  const visible = useMemo(() => visibleObjects(useStore.getState()), [objects, filters, sort])
  const stats = useMemo(() => objectStats(objects), [objects])

  const filtered = useMemo(() => {
    if (!radiusFilter) return visible
    return visible
      .map((o) => ({ o, d: haversine(centroidOf(o.geometry), viewCenter) }))
      .filter((x) => x.d <= radiusFilter)
      .sort((a, b) => a.d - b.d)
  }, [visible, radiusFilter, viewCenter])

  const allTags = useMemo(() => {
    const s = new Set<string>()
    objects.forEach((o) => o.tags.forEach((t) => s.add(t)))
    return [...s].slice(0, 24)
  }, [objects])

  const usedCategories = useMemo(() => {
    const s = new Set(objects.map((o) => o.category))
    return CATEGORIES.filter((c) => s.has(c.id))
  }, [objects])

  return (
    <AnimatePresence>
      {open && (
        <motion.section
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ duration: 0.26, ease: [0.22, 0.61, 0.36, 1] }}
          className="pointer-events-auto absolute safe-bottom left-2.5 right-2.5 z-40 w-auto sm:left-[62px] sm:right-auto sm:z-30 sm:w-[min(860px,calc(100vw-70px))]"
          style={{
            // on phones the sheet spans the free space; the desktop column maths would go negative there
            maxWidth: compact
              ? undefined
              : selectedId
                ? 'min(700px, calc(100vw - 436px))'
                : 'min(860px, calc(100vw - 76px))',
          }}
        >
          <div className="panel flex h-[min(46vh,380px)] flex-col overflow-hidden">
            <div className="flex items-center gap-2 border-b border-[rgb(var(--line)/0.09)] px-3 py-2">
              <div className="flex items-center gap-1.5">
                <Icon name="list" size={14} className="muted" />
                <span className="text-[12.5px] font-semibold">Объекты</span>
                <span className="chip !py-0.5">{filtered.length}</span>
              </div>

              <div className="ml-2 hidden w-[190px] md:block">
                <div className="flex h-8 items-center gap-1.5 rounded-lg border border-[rgb(var(--line)/0.09)] bg-[rgb(var(--line)/0.05)] px-2">
                  <Icon name="search" size={12} className="muted" />
                  <input
                    value={filters.query}
                    onChange={(e) => setFilter({ query: e.target.value })}
                    placeholder="Фильтр по имени, тегу…"
                    className="w-full bg-transparent text-[11.5px] outline-none"
                  />
                </div>
              </div>

              <div className="flex-1" />

              <div className="hidden sm:block">
                <Segmented
                  size="sm"
                  value={tab}
                  onChange={setTab}
                  options={[
                    { id: 'list', label: 'Список', icon: 'list' },
                    { id: 'stats', label: 'Статистика', icon: 'chart' },
                  ]}
                />
              </div>

              <Popover
                width={280}
                trigger={(o, toggle) => (
                  <button
                    className="tool-btn h-8 w-8"
                    data-active={o || filters.categories.length > 0 || !!radiusFilter}
                    onClick={toggle}
                    title="Фильтры"
                  >
                    <Icon name="filter" size={14} />
                    {(filters.categories.length > 0 || radiusFilter > 0) && (
                      <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[rgb(var(--accent))]" />
                    )}
                  </button>
                )}
              >
                {() => (
                  <div className="space-y-2">
                    <div>
                      <div className="muted mb-1 px-1 text-[9.5px] font-semibold uppercase tracking-wider">Категории</div>
                      <div className="flex flex-wrap gap-1">
                        {CATEGORIES.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => toggleCategoryFilter(c.id)}
                            className={`chip ${filters.categories.includes(c.id) ? 'chip-active' : ''}`}
                            title={c.labelRu}
                          >
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />
                            {c.labelRu.split(' ')[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                    {allTags.length > 0 && (
                      <div>
                        <div className="muted mb-1 px-1 text-[9.5px] font-semibold uppercase tracking-wider">Теги</div>
                        <div className="flex flex-wrap gap-1">
                          {allTags.map((t) => (
                            <button
                              key={t}
                              onClick={() =>
                                setFilter({
                                  tags: filters.tags.includes(t) ? filters.tags.filter((x) => x !== t) : [...filters.tags, t],
                                })
                              }
                              className={`chip ${filters.tags.includes(t) ? 'chip-active' : ''}`}
                            >
                              #{t}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <div className="muted mb-1 flex items-center justify-between px-1 text-[9.5px] font-semibold uppercase tracking-wider">
                        <span>Радиус от центра вида</span>
                        <span className="font-mono">{radiusFilter ? formatDistance(radiusFilter) : 'выкл'}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={8000}
                        step={100}
                        value={radiusFilter}
                        onChange={(e) => setRadiusFilter(Number(e.target.value))}
                        className="w-full"
                      />
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <button className="chip" onClick={() => setFilter({ onlyPinned: !filters.onlyPinned })}>
                        <Icon name="pin" size={10} /> только закреплённые
                      </button>
                      <button
                        className="muted text-[10.5px] hover:text-[rgb(var(--text))]"
                        onClick={() => {
                          setFilter({ categories: [], tags: [], query: '', onlyPinned: false })
                          setRadiusFilter(0)
                        }}
                      >
                        сбросить
                      </button>
                    </div>
                  </div>
                )}
              </Popover>

              <Popover
                width={170}
                trigger={(o, toggle) => (
                  <button className="tool-btn h-8 w-8" data-active={o} onClick={toggle} title="Сортировка">
                    <Icon name="sort" size={14} />
                  </button>
                )}
              >
                {(close) => (
                  <div>
                    {(
                      [
                        ['updated', 'По изменению'],
                        ['created', 'По дате создания'],
                        ['name', 'По имени'],
                        ['category', 'По категории'],
                        ['size', 'По размеру'],
                      ] as [SortKey, string][]
                    ).map(([k, label]) => (
                      <button
                        key={k}
                        onClick={() => {
                          setSort(k)
                          close()
                        }}
                        className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[11.5px] hover:bg-[rgb(var(--line)/0.08)]"
                      >
                        {label}
                        {sort === k && <Icon name="check" size={12} className="text-[rgb(var(--accent-soft))]" />}
                      </button>
                    ))}
                  </div>
                )}
              </Popover>

              <button className="tool-btn h-8 w-8" onClick={() => setOpen(false)} title="Свернуть">
                <Icon name="down" size={15} />
              </button>
            </div>

            {tab === 'list' ? (
              <div className="scroll-fade flex-1 overflow-y-auto px-1.5 py-1.5">
                {usedCategories.length > 0 && (
                  <div className="mb-1.5 flex flex-wrap gap-1 px-1">
                    {usedCategories.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => toggleCategoryFilter(c.id)}
                        className={`chip ${filters.categories.includes(c.id) ? 'chip-active' : ''}`}
                      >
                        <MapIcon glyph={c.icon} color={c.color} size={11} />
                        {c.labelRu.split(' ')[0]}
                        <span className="font-mono opacity-60">{stats.byCategory[c.id]}</span>
                      </button>
                    ))}
                  </div>
                )}
                {filtered.length === 0 && (
                  <div className="muted flex flex-col items-center gap-1 py-8 text-center text-[11.5px]">
                    <Icon name="search" size={18} />
                    Нет объектов — нарисуйте что-нибудь на карте
                  </div>
                )}
                {filtered.slice(0, 300).map((row) => {
                  const o = 'o' in row ? row.o : row
                  const d = 'd' in row ? row.d : null
                  const cat = getCategory(o.category)
                  const metrics =
                    o.type === 'line'
                      ? formatDistance(geometryLength(o.geometry))
                      : geometryArea(o.geometry) > 0
                        ? `S ${formatArea(geometryArea(o.geometry))}`
                        : ''
                  return (
                    <div
                      key={o.id}
                      onClick={() => select(o.id)}
                      onDoubleClick={() => requestFlyTo(centroidOf(o.geometry), 18)}
                      className={`group flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors ${
                        selectedId === o.id ? 'bg-[rgb(var(--accent)/0.14)] ring-1 ring-[rgb(var(--accent)/0.35)]' : 'hover:bg-[rgb(var(--line)/0.06)]'
                      }`}
                    >
                      <MapIcon glyph={o.icon || cat.icon} color={o.color} size={22} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[12px] font-medium">{o.name || 'Без названия'}</span>
                          {o.pinned && <Icon name="pin" size={9} className="shrink-0 text-[rgb(var(--accent-soft))]" />}
                        </div>
                        <div className="muted flex items-center gap-1.5 text-[10px]">
                          <span>{cat.labelRu}</span>
                          {metrics && <span>· {metrics}</span>}
                          {o.height ? <span>· {o.height} м</span> : null}
                          {d != null && <span>· {formatDistance(d)}</span>}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          className="btn-ghost h-6 w-6"
                          title="Приблизить"
                          onClick={(e) => {
                            e.stopPropagation()
                            requestFlyTo(centroidOf(o.geometry), 18)
                          }}
                        >
                          <Icon name="target" size={12} />
                        </button>
                        <button
                          className="btn-ghost h-6 w-6"
                          title="Закрепить"
                          onClick={(e) => {
                            e.stopPropagation()
                            update(o.id, { pinned: !o.pinned })
                          }}
                        >
                          <Icon name="pin" size={12} />
                        </button>
                        <button
                          className="btn-ghost h-6 w-6 text-danger"
                          title="Удалить"
                          onClick={(e) => {
                            e.stopPropagation()
                            remove(o.id)
                          }}
                        >
                          <Icon name="trash" size={12} />
                        </button>
                      </div>
                    </div>
                  )
                })}
                {filtered.length > 300 && (
                  <div className="muted py-2 text-center text-[10px]">Показаны первые 300 из {filtered.length}</div>
                )}
              </div>
            ) : (
              <div className="scroll-fade flex-1 overflow-y-auto p-3">
                <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <StatCard label="Всего объектов" value={String(stats.total)} />
                  <StatCard label="Здания" value={String(stats.buildings)} />
                  <StatCard label="Ограждения" value={String(stats.fences)} />
                  <StatCard label="Длина линий" value={formatDistance(stats.length)} />
                </div>
                <div className="space-y-1.5">
                  {Object.entries(stats.byCategory)
                    .sort((a, b) => b[1] - a[1])
                    .map(([id, n]) => {
                      const cat = getCategory(id)
                      const pct = Math.round((n / Math.max(1, stats.total)) * 100)
                      return (
                        <div key={id} className="flex items-center gap-2">
                          <MapIcon glyph={cat.icon} color={cat.color} size={15} />
                          <span className="w-[130px] shrink-0 truncate text-[11px]">{cat.labelRu}</span>
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[rgb(var(--line)/0.08)]">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.5, ease: [0.22, 0.61, 0.36, 1] }}
                              className="h-full rounded-full"
                              style={{ background: cat.color }}
                            />
                          </div>
                          <span className="muted w-9 shrink-0 text-right font-mono text-[10px]">{n}</span>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[rgb(var(--line)/0.08)] bg-[rgb(var(--line)/0.04)] px-2.5 py-2">
      <div className="text-[15px] font-semibold leading-none">{value}</div>
      <div className="muted mt-1 text-[9.5px] uppercase tracking-wide">{label}</div>
    </div>
  )
}
