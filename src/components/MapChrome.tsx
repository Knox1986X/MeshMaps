import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { useStore } from '@/store/useStore'
import { mapRegistry } from '@/map/registry'
import { BASEMAPS, attributionFor, buildStyle } from '@/map/styles'
import { formatCoords, formatDms } from '@/utils/geo'
import { Icon } from './Icon'
import { AnimatePresence } from 'framer-motion'

/* ------------------------------------------------------------------ */
/* scale + compass + coordinates                                       */
/* ------------------------------------------------------------------ */

function niceScale(mPerPx: number) {
  const target = 92 * mPerPx
  const pow = Math.pow(10, Math.floor(Math.log10(target)))
  const candidates = [1, 2, 5, 10].map((n) => n * pow)
  const meters = candidates.filter((c) => c <= target).pop() ?? candidates[0]
  return { meters, px: meters / mPerPx }
}

function formatScale(m: number) {
  if (m >= 1000) return `${m / 1000} км`
  return `${m} м`
}

export function MapChrome() {
  const cursor = useStore((s) => s.cursor)
  const view = useStore((s) => s.view)
  const theme = useStore((s) => s.theme)
  const basemap = useStore((s) => s.basemap)
  const mode = useStore((s) => s.mode)
  const split = useStore((s) => s.split)
  const toggleSplit = useStore((s) => s.toggleSplit)
  const year = useStore((s) => s.year)
  const setYear = useStore((s) => s.setYear)
  const toast = useStore((s) => s.toast)
  const selectedId = useStore((s) => s.selectedId)
  const bottomOpen = useStore((s) => s.bottomOpen)
  const [showMini, setShowMini] = useState(false)
  const [showTime, setShowTime] = useState(false)

  const mPerPx = (156543.03392 * Math.cos((view.center[1] * Math.PI) / 180)) / Math.pow(2, view.zoom)
  const scale = niceScale(Math.max(mPerPx, 1e-6))

  const zoomBy = (delta: number) => {
    const map = mapRegistry.main
    if (map) map.easeTo({ zoom: map.getZoom() + delta, duration: 320 })
  }

  const resetNorth = () => {
    const map = mapRegistry.main
    if (map) map.easeTo({ bearing: 0, pitch: useStore.getState().mode === '3d' ? 55 : 0, duration: 600 })
  }

  const locateMe = () => {
    if (!navigator.geolocation) return toast('warn', 'Геолокация недоступна')
    toast('info', 'Определяем местоположение…')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c: [number, number] = [pos.coords.longitude, pos.coords.latitude]
        useStore.getState().requestFlyTo(c, 17)
        const map = mapRegistry.main
        if (map) {
          const el = document.createElement('div')
          el.style.cssText = 'width:16px;height:16px;border-radius:50%;background:#4f8cff;border:2.5px solid #fff;box-shadow:0 0 0 6px rgba(79,140,255,.25)'
          new maplibregl.Marker({ element: el }).setLngLat(c).addTo(map)
        }
        toast('ok', `Вы здесь: ${formatCoords(c[0], c[1])}`)
      },
      () => toast('error', 'Не удалось получить координаты'),
      { enableHighAccuracy: true, timeout: 9000 },
    )
  }

  return (
    <>
      <div className="pointer-events-none absolute bottom-2.5 left-2.5 z-30 flex flex-col items-start gap-2">
        <AnimatePresence>
          {showTime && (
            <div className="panel pointer-events-auto w-[248px] p-2.5">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] font-medium">Машина времени</span>
                <button className="muted hover:text-[rgb(var(--text))]" onClick={() => { setYear(null); setShowTime(false) }}>
                  <Icon name="close" size={12} />
                </button>
              </div>
              <input
                type="range"
                min={1900}
                max={2035}
                value={year ?? 2025}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full"
              />
              <div className="mt-1 flex items-center justify-between">
                <span className="font-mono text-[13px] font-semibold">{year ?? 'все'}</span>
                <button className="chip" onClick={() => setYear(null)}>
                  все годы
                </button>
              </div>
              <p className="muted mt-1 text-[9.5px]">Показываются объекты с годами жизни в этот период.</p>
            </div>
          )}
        </AnimatePresence>

        <div className="flex items-end gap-2">
          <div className="panel pointer-events-auto flex w-10 flex-col items-center gap-0.5 p-1">
            <button className="tool-btn h-8 w-8" onClick={resetNorth} title="Повернуть на север">
              <Compass bearing={view.bearing} />
            </button>
            <button className="tool-btn h-8 w-8" onClick={() => zoomBy(1)} title="Приблизить">
              <Icon name="plus" size={15} />
            </button>
            <button className="tool-btn h-8 w-8" onClick={() => zoomBy(-1)} title="Отдалить">
              <svg width="15" height="15" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                <path d="M4.5 12h15" />
              </svg>
            </button>
            <button className="tool-btn h-8 w-8" onClick={locateMe} title="Моё местоположение">
              <Icon name="location" size={15} />
            </button>
          </div>

          {/* coordinates/scale footer hides on phones when the object list is open */}
          <div
            className={`panel pointer-events-auto flex flex-col gap-1 px-2.5 py-1.5 ${
              bottomOpen ? 'max-sm:hidden' : ''
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="muted w-[104px] shrink-0 font-mono text-[10.5px]">
                {cursor ? formatCoords(cursor[0], cursor[1]) : formatCoords(view.center[0], view.center[1])}
              </span>
              <span className="hidden font-mono text-[9.5px] text-[rgb(var(--muted)/0.8)] sm:block">
                {cursor ? formatDms(cursor[0], cursor[1]) : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div
                  className="h-[3px] rounded-full bg-[rgb(var(--text)/0.55)]"
                  style={{ width: Math.max(24, scale.px) }}
                />
                <span className="muted text-[9.5px]">{formatScale(scale.meters)}</span>
              </div>
              <span className="muted ml-auto font-mono text-[9.5px]">z{view.zoom.toFixed(1)}</span>
            </div>
            <div className="muted flex items-center gap-1.5 text-[8.5px] leading-none">
              <span className="uppercase tracking-wider">{mode === '3d' ? '3D' : '2D'}</span>
              <span>·</span>
              <span className="truncate">{BASEMAPS[basemap].labelRu}</span>
              <span>·</span>
              <span className="truncate">{attributionFor(basemap)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* right-bottom utility rail */}
      <div
        className={`pointer-events-none absolute bottom-2.5 right-2.5 z-20 flex flex-col items-end gap-2 transition-[right] duration-300 ${
          selectedId ? 'sm:right-[374px]' : ''
        }`}
      >
        <AnimatePresence>
          {showMini && (
            <div className="panel pointer-events-auto overflow-hidden p-1">
              <MiniMap theme={theme} />
            </div>
          )}
        </AnimatePresence>
        <div className="panel pointer-events-auto flex items-center gap-0.5 p-1">
          <button className="tool-btn h-8 w-8" data-active={showMini} onClick={() => setShowMini((v) => !v)} title="Мини-карта">
            <Icon name="globe" size={14} />
          </button>
          <button
            className="tool-btn h-8 w-8"
            data-active={showTime || year != null}
            onClick={() => setShowTime((v) => !v)}
            title="Машина времени"
          >
            <Icon name="clock" size={14} />
          </button>
          <button className="tool-btn h-8 w-8" data-active={split} onClick={toggleSplit} title="3D-превью (сравнение 2D/3D)">
            <Icon name="cube" size={14} />
          </button>
        </div>
      </div>
    </>
  )
}

function Compass({ bearing }: { bearing: number }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" style={{ transform: `rotate(${-bearing}deg)`, transition: 'transform .25s ease' }}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity=".35" strokeWidth="1.4" />
      <path d="M12 4.6 14.4 12.6 12 11.5 9.6 12.6z" fill="#f87171" />
      <path d="M12 19.4 9.6 11.4 12 12.5 14.4 11.4z" fill="currentColor" fillOpacity=".55" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* minimap                                                             */
/* ------------------------------------------------------------------ */

function MiniMap({ theme }: { theme: 'dark' | 'light' }) {
  const ref = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    if (!ref.current) return
    const st = useStore.getState()
    const mini = new maplibregl.Map({
      container: ref.current,
      style: buildStyle(st.basemap === 'blank' ? 'osm' : st.basemap, theme),
      center: st.view.center,
      zoom: Math.max(3, st.view.zoom - 4),
      interactive: true,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    })
    mapRef.current = mini
    mini.on('load', () => {
      try {
        // only raster basemaps have this layer; the vector one is a background layer
        const layer = mini.getLayer('basemap')
        if (layer && layer.type === 'raster') {
          mini.setLayoutProperty('basemap', 'raster-opacity', theme === 'dark' ? 0.85 : 1)
        }
      } catch {
        /* noop */
      }
    })
    mini.on('click', (e) => useStore.getState().requestFlyTo([e.lngLat.lng, e.lngLat.lat], st.view.zoom))
    const unsub = useStore.subscribe((s, p) => {
      if (s.view.center !== p.view.center || s.view.zoom !== p.view.zoom) {
        mini.jumpTo({ center: s.view.center, zoom: Math.max(3, s.view.zoom - 4) })
      }
    })
    return () => {
      unsub()
      mini.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={ref} className="h-[118px] w-[176px] overflow-hidden rounded-xl" />
}
