import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '@/store/useStore'
import type { SearchResult } from '@/types'
import { searchPlaces } from '@/api'
import { mapRegistry } from '@/map/registry'
import { parseCoordinateInput } from '@/utils/geo'
import { Icon } from './Icon'

export function SearchBox({
  autoFocus = false,
  onClose,
}: {
  /** mobile overlay: focus the field as soon as it appears */
  autoFocus?: boolean
  /** shown as a ✕ on the right (mobile overlay) */
  onClose?: () => void
} = {}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const coord = parseCoordinateInput(q)

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  useEffect(() => {
    if (q.trim().length < 3) {
      setResults([])
      setLoading(false)
      return
    }
    const ctrl = new AbortController()
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const r = await searchPlaces(q, ctrl.signal)
        setResults(r.slice(0, 7))
        setActive(0)
      } catch {
        /* aborted or offline */
      } finally {
        setLoading(false)
      }
    }, 420)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [q])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const goTo = (r: SearchResult) => {
    const map = mapRegistry.main
    setOpen(false)
    setQ(r.label.split(',')[0])
    if (!map) return
    if (r.bbox && Math.abs(r.bbox[2] - r.bbox[0]) > 0.0005) {
      map.fitBounds(
        [
          [r.bbox[0], r.bbox[1]],
          [r.bbox[2], r.bbox[3]],
        ],
        { padding: 90, duration: 1100, maxZoom: 17.5 },
      )
    } else {
      useStore.getState().requestFlyTo(r.center, 17)
    }
    useStore.getState().toast('info', r.label.slice(0, 70))
    onClose?.()
  }

  const goToCoords = () => {
    if (!coord) return
    useStore.getState().requestFlyTo(coord, 17.2)
    setOpen(false)
    useStore.getState().toast('ok', `Переход к ${coord[1].toFixed(4)}, ${coord[0].toFixed(4)}`)
    onClose?.()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
      return
    }
    if (e.key === 'Enter') {
      if (coord) return goToCoords()
      if (results[active]) goTo(results[active])
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(results.length - 1, i + 1))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    }
  }

  return (
    <div className="relative w-full" ref={boxRef}>
      <div className="panel flex h-10 items-center gap-2 px-3">
        <Icon name="search" size={15} className="muted shrink-0" />
        <input
          ref={inputRef}
          id="mm-search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Поиск адреса, места или координат…"
          className="h-full w-full min-w-0 bg-transparent text-[12.5px] outline-none placeholder:text-[rgb(var(--muted)/0.8)]"
          spellCheck={false}
        />
        {loading ? (
          <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-[1.5px] border-[rgb(var(--line)/0.3)] border-t-[rgb(var(--accent))]" />
        ) : (
          q && (
            <button
              className="muted shrink-0 hover:text-[rgb(var(--text))]"
              onClick={() => {
                setQ('')
                setResults([])
              }}
              aria-label="Очистить"
            >
              <Icon name="close" size={13} />
            </button>
          )
        )}
        <span className="muted hidden shrink-0 font-mono text-[10px] sm:block">⌘K</span>
        {onClose && (
          <button
            className="muted shrink-0 hover:text-[rgb(var(--text))]"
            onClick={onClose}
            aria-label="Закрыть поиск"
            data-mm-search-close="1"
          >
            <Icon name="close" size={15} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && (q.trim().length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
            className="panel-solid absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-[60vh] overflow-y-auto p-1.5"
          >
            {coord && (
              <button
                onClick={goToCoords}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-[rgb(var(--line)/0.08)]"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[rgb(var(--accent)/0.16)] text-[rgb(var(--accent-soft))]">
                  <Icon name="target" size={14} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-medium">Перейти к координатам</span>
                  <span className="muted block truncate font-mono text-[10.5px]">
                    {coord[1].toFixed(5)}, {coord[0].toFixed(5)}
                  </span>
                </span>
                <Icon name="right" size={13} className="muted" />
              </button>
            )}
            {results.map((r, i) => (
              <button
                key={r.id}
                onMouseEnter={() => setActive(i)}
                onClick={() => goTo(r)}
                className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left ${
                  i === active ? 'bg-[rgb(var(--line)/0.09)]' : ''
                }`}
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--line)/0.06)]">
                  <Icon name="pin" size={13} className="muted" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px]">{r.label.split(',')[0]}</span>
                  <span className="muted block truncate text-[10.5px]">{r.label.split(',').slice(1).join(',')}</span>
                </span>
              </button>
            ))}
            {!results.length && !coord && !loading && q.trim().length >= 3 && (
              <div className="muted px-3 py-4 text-center text-[11.5px]">Ничего не найдено</div>
            )}
            {q.trim().length < 3 && !coord && (
              <div className="muted px-3 py-3 text-[11px]">
                Введите адрес, название или координаты вида <span className="font-mono">55.75, 37.62</span>
              </div>
            )}
            <div className="muted flex items-center justify-between px-2.5 pb-1 pt-2 text-[9.5px]">
              <span>Nominatim · OpenStreetMap</span>
              <span className="flex gap-1">
                <span className="kbd">↑</span>
                <span className="kbd">↓</span>
                <span className="kbd">↵</span>
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
