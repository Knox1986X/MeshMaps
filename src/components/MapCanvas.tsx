import { useEffect, useRef, useState } from 'react'
import maplibregl, { type Map as MapLibreMap, type MapMouseEvent, Popup } from 'maplibre-gl'
import type { FeatureCollection, Geometry, Point } from 'geojson'
import { featureCollection } from '@turf/helpers'
import { useStore } from '@/store/useStore'
import type { MapObject } from '@/types'
import { getCategory } from '@/icons/categories'
import { buildStyle, isVectorBasemap } from '@/map/styles'
import { describeBuilding } from '@/map/realism'
import { isBasemapReachable } from '@/map/basemapProbe'
import { addMeshLayers, CLICK_LAYERS, HIT_LAYERS, SRC, setSourceData } from '@/map/layers'
import {
  applyData,
  applyHillshade,
  applyShadows,
  applyTerrain,
  applyVisibility,
  popupHtml,
  syncBasemap3d,
  syncMode,
  updateGrid,
} from '@/map/controller'
import { mapRegistry } from '@/map/registry'
import { draftFeatureCollection } from '@/drawing'
import { fetchOsmBuildings, fetchRoute, reverseGeocode } from '@/api'
import { centroidOf, formatCoords } from '@/utils/geo'

const DRAW_TOOLS = ['point', 'line', 'polygon', 'building', 'fence', 'buffer', 'measure-distance', 'measure-area', 'route']

interface MenuState {
  x: number
  y: number
  lngLat: [number, number]
  objectId: string | null
}

const osmCache = new Map<string, FeatureCollection<Geometry>>()
const emptyFc: FeatureCollection = featureCollection([])

export default function MapCanvas({ variant = 'main' }: { variant?: 'main' | 'pip' }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const readyRef = useRef(false)
  const popupRef = useRef<Popup | null>(null)
  const hoverPopupRef = useRef<Popup | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [fatal, setFatal] = useState<string | null>(null)
  const basemap = useStore((s) => s.basemap)

  useEffect(() => {
    if (!containerRef.current) return
    const st = useStore.getState()

    let map: MapLibreMap
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: buildStyle(st.basemap, st.theme),
        center: st.view.center,
        zoom: variant === 'pip' ? Math.max(13.4, st.view.zoom) : st.view.zoom,
        pitch: variant === 'pip' ? 58 : st.view.pitch,
        bearing: variant === 'pip' ? -26 : st.view.bearing,
        maxPitch: 85,
        attributionControl: false,
        // PNG-экспорт читает канвас, поэтому буфер сохраняем — но DPR ограничиваем:
        // на телефоне devicePixelRatio 3 означает 9x пикселей и заметные подтормаживания.
        preserveDrawingBuffer: true,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        antialias: (window.devicePixelRatio || 1) <= 1.5,
        fadeDuration: 140,
        dragRotate: true,
        keyboard: false,
      })
    } catch (err) {
      console.error('map init failed', err)
      setFatal(err instanceof Error ? err.message : 'WebGL недоступен')
      return
    }
    mapRef.current = map
    if (variant === 'pip') mapRegistry.pip = map
    else mapRegistry.main = map


    // Second safety net (the first one is the up-front probe): if the vector tiles keep
    // failing after the style loaded, drop down to plain OSM raster so the map is never empty.
    let vectorTileErrors = 0
    let fellBack = false
    map.on('error', (e) => {
      const msg = String((e as { error?: Error }).error?.message ?? '')
      const sourceId = (e as { sourceId?: string }).sourceId
      if (msg.includes('API KEY')) console.warn('[meshmaps] basemap provider refused the tiles:', msg)
      if (variant !== 'main' || fellBack || sourceId !== 'openmaptiles') return
      if (navigator.onLine === false || useStore.getState().packs.length > 0) return
      vectorTileErrors += 1
      if (vectorTileErrors >= 6) {
        fellBack = true
        const st2 = useStore.getState()
        if (st2.basemap !== 'osm') {
          st2.setBasemap('osm')
          st2.toast('warn', 'Векторная подложка не загрузилась — включён OSM')
        }
      }
    })

    const refresh = () => {
      const s = useStore.getState()
      addMeshLayers(map, s.theme)
      readyRef.current = true
      void applyData(map, s)
      applyVisibility(map, s)
      applyTerrain(map, s)
      syncBasemap3d(map, s)
      applyHillshade(map, s)
      applyShadows(map, s)
      updateGrid(map, s)
      if (variant === 'pip') {
        try {
          map.setLayoutProperty('mm-labels-text', 'visibility', 'none')
        } catch {
          /* layer not ready */
        }
      }
    }

    map.on('style.load', refresh)
    map.once('load', refresh)

    /* ---------------- camera sync (pip follows main) ---------------- */
    if (variant === 'pip') {
      map.dragRotate.disable()
      map.touchZoomRotate.disableRotation()
    }

    /* ---------------- OSM 3D buildings (Overpass) ---------------- */
    let osmTimer: number | undefined
    const bboxKey = (m: MapLibreMap) => {
      const b = m.getBounds()
      return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((v) => v.toFixed(3)).join(',')
    }
    const scheduleOsm = () => {
      const s = useStore.getState()
      if (variant !== 'main') return
      const widgetNeeded = !isVectorBasemap(s.basemap)
      const wants = widgetNeeded && s.mode === '3d' && s.layers.osm3d && s.settings.osmBuildings
      window.clearTimeout(osmTimer)
      if (!wants || map.getZoom() < 14.1) {
        setSourceData(map, SRC.osm3d, emptyFc)
        return
      }
      osmTimer = window.setTimeout(async () => {
        const b = map.getBounds()
        const key = bboxKey(map)
        if (osmCache.has(key)) {
          setSourceData(map, SRC.osm3d, osmCache.get(key)!)
          return
        }
        try {
          const fc = await fetchOsmBuildings([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()])
          if (osmCache.size > 10) osmCache.clear()
          osmCache.set(key, fc)
          if (bboxKey(map) === key) setSourceData(map, SRC.osm3d, fc)
        } catch {
          setSourceData(map, SRC.osm3d, emptyFc)
        }
      }, 950)
    }

    map.on('moveend', () => {
      const s = useStore.getState()
      const c = map.getCenter()
      if (variant === 'main') {
        s.setView({ center: [c.lng, c.lat], zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() })
      }
      updateGrid(map, s)
      scheduleOsm()
    })

    let pipQueued = false
    map.on('move', () => {
      if (variant !== 'main' || pipQueued) return
      const pip = mapRegistry.pip
      if (!pip) return
      pipQueued = true
      requestAnimationFrame(() => {
        pipQueued = false
        const target = mapRegistry.pip
        if (!target) return
        try {
          target.jumpTo({ center: map.getCenter(), zoom: map.getZoom() })
        } catch {
          /* pip may be removed mid-flight */
        }
      })
    })

    /* ---------------- interactions ---------------- */
    let lastPreview = 0
    if (variant === 'main') {
      // mousemove fires ~120 times per second on a trackpad; writing every event into the
      // store re-rendered the whole UI (that is what made the app feel frozen).
      let lastCursor = 0
      let lastHover = 0
      map.on('mousemove', (e) => {
        const s = useStore.getState()
        const now = performance.now()
        const tool = s.tool
        const drawing = DRAW_TOOLS.includes(tool)
        if (now - lastCursor > 90) {
          lastCursor = now
          s.setCursor([e.lngLat.lng, e.lngLat.lat])
        }
        if (s.draft && now - lastPreview > 55) {
          lastPreview = now
          setSourceData(
            map,
            SRC.draft,
            draftFeatureCollection({ ...s.draft, hover: [e.lngLat.lng, e.lngLat.lat] }),
          )
        }
        map.getCanvas().style.cursor = drawing ? 'crosshair' : 'grab'
        if (drawing) return
        if (now - lastHover < 110) return
        lastHover = now

        const features = map.queryRenderedFeatures(e.point, { layers: HIT_LAYERS })
        const id = features[0]?.properties?.objectId ? String(features[0].properties.objectId) : null
        if (id !== s.hoverId) s.hover(id)
        // hover tooltip
        if (id) {
          const obj = s.objects.find((o) => o.id === id)
          if (obj) {
            const c = centroidOf(obj.geometry)
            const html = `<div class="panel px-2.5 py-1.5 !rounded-xl animate-floatIn">
              <div class="text-[12px] font-semibold leading-tight">${escapeHtml(obj.name || 'Без названия')}</div>
              <div class="muted text-[10.5px]">${escapeHtml(getCategory(obj.category).labelRu)}</div>
            </div>`
            if (!hoverPopupRef.current) {
              hoverPopupRef.current = new Popup({ closeButton: false, closeOnClick: false, offset: 16, className: 'mm-hover-popup' })
            }
            hoverPopupRef.current.setLngLat(c).setHTML(html).addTo(map)
          }
        } else if (hoverPopupRef.current) {
          hoverPopupRef.current.remove()
          hoverPopupRef.current = null
        }
      })

      map.on('mouseout', () => {
        hoverPopupRef.current?.remove()
        hoverPopupRef.current = null
      })

      map.on('click', async (e: MapMouseEvent) => {
        const s = useStore.getState()
        const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat]
        if (menu) setMenu(null)

        if (s.tool === 'point') {
          addPointAt(lngLat, s)
          return
        }
        if (s.tool === 'buffer') {
          addPointAt(lngLat, s, 180)
          return
        }
        if (s.tool === 'measure-distance' || s.tool === 'measure-area') {
          s.setMeasurePoints([...s.measure.points, lngLat])
          return
        }
        if (s.tool === 'route') {
          const points = [...s.route.points, lngLat]
          s.setRoutePoints(points)
          if (points.length >= 2) {
            try {
              const result = await fetchRoute(points, s.route.profile)
              useStore.getState().setRouteResult(result)
              useStore.getState().toast('ok', `Маршрут ${(result.distance / 1000).toFixed(2)} км · ${Math.round(result.duration / 60)} мин`)
            } catch {
              useStore.getState().toast('error', 'Не удалось построить маршрут')
            }
          }
          return
        }
        if (s.tool === 'line' || s.tool === 'polygon' || s.tool === 'building' || s.tool === 'fence') {
          s.pushDraftPoint(lngLat)
          return
        }

        // ---- select mode ----
        const features = map.queryRenderedFeatures(e.point, { layers: CLICK_LAYERS })
        const cluster = features.find((f) => f.properties?.point_count)
        if (cluster && cluster.geometry.type === 'Point') {
          const src = map.getSource(SRC.clusters) as { getClusterExpansionZoom?: (id: number) => Promise<number> }
          const cid = Number(cluster.properties?.cluster_id)
          try {
            const zoom = (await src.getClusterExpansionZoom?.(cid)) ?? map.getZoom() + 2
            map.easeTo({ center: cluster.geometry.coordinates as [number, number], zoom: zoom + 0.15, duration: 620 })
          } catch {
            map.easeTo({ center: cluster.geometry.coordinates as [number, number], zoom: map.getZoom() + 2 })
          }
          return
        }
        const hit = features.find((f) => f.properties?.objectId)
        if (hit) {
          const obj = s.objects.find((o) => o.id === String(hit.properties?.objectId))
          if (obj) showPopup(obj)
          s.select(String(hit.properties?.objectId))
          return
        }
        s.select(null)
        popupRef.current?.remove()
        popupRef.current = null

        // A tap on the real city: show its metric height and floor count, so "как в 2ГИС"
        // still tells you something factual. Only the keyless vector basemaps carry heights.
        if (isVectorBasemap(s.basemap) && map.getZoom() >= 13.4) {
          const buildingLayers = ['basemap-buildings-3d', 'basemap-buildings'].filter((id) =>
            map.getLayer(id),
          )
          if (buildingLayers.length) {
            const hit = map.queryRenderedFeatures(e.point, { layers: buildingLayers })[0]
            const text = hit ? describeBuilding(hit.properties as Record<string, unknown>) : null
            if (text) {
              popupRef.current = new Popup({ closeButton: true, closeOnClick: true, offset: 12, className: 'mm-hover-popup' })
                .setLngLat(lngLat)
                .setHTML(
                  `<div class="panel px-2.5 py-1.5 !rounded-xl"><div class="text-[12px] font-semibold leading-tight">${escapeHtml(
                    text,
                  )}</div><div class="muted text-[10px]">высота и этажи из OpenStreetMap</div></div>`,
                )
                .addTo(map)
            }
          }
        }
      })

      map.on('dblclick', (e) => {
        const s = useStore.getState()
        if (s.tool !== 'select') return
        const features = map.queryRenderedFeatures(e.point, { layers: HIT_LAYERS })
        const id = features[0]?.properties?.objectId
        if (id) {
          const obj = s.objects.find((o) => o.id === String(id))
          if (obj) s.requestFlyTo(centroidOf(obj.geometry), Math.max(map.getZoom() + 1.2, 17))
        }
      })

      map.on('contextmenu', (e) => {
        e.preventDefault()
        const features = map.queryRenderedFeatures(e.point, { layers: HIT_LAYERS })
        const id = features[0]?.properties?.objectId ?? null
        setMenu({
          x: e.point.x,
          y: e.point.y,
          lngLat: [e.lngLat.lng, e.lngLat.lat],
          objectId: id ? String(id) : null,
        })
      })

      map.getCanvas().addEventListener('webglcontextlost', (ev) => ev.preventDefault())
    }

    /* ---------------- store subscription ---------------- */
    const unsub = useStore.subscribe((s, prev) => {
      const m = mapRef.current
      if (!m) return
      if (!readyRef.current) return

      if (
        s.objects !== prev.objects ||
        s.selectedId !== prev.selectedId ||
        s.hoverId !== prev.hoverId ||
        s.year !== prev.year ||
        s.draft !== prev.draft ||
        s.measure !== prev.measure ||
        s.route !== prev.route ||
        s.filters !== prev.filters ||
        s.sort !== prev.sort
      ) {
        void applyData(m, s)
      }
      if (s.layers !== prev.layers || s.mode !== prev.mode || s.settings.cluster !== prev.settings.cluster) {
        applyVisibility(m, s)
      }
      if (s.mode !== prev.mode) {
        syncMode(m, s)
        scheduleOsm()
      }
      if (s.layers.osm3d !== prev.layers.osm3d || s.settings.osmBuildings !== prev.settings.osmBuildings) {
        syncBasemap3d(m, s)
        scheduleOsm()
      }
      if (s.settings.osmBuildings !== prev.settings.osmBuildings) syncBasemap3d(m, s)
      if (s.layers.hillshade !== prev.layers.hillshade) applyHillshade(m, s)
      if (s.layers.terrain !== prev.layers.terrain) applyTerrain(m, s)
      if (s.layers.shadows !== prev.layers.shadows || s.settings.sunDate !== prev.settings.sunDate) applyShadows(m, s)
      if (s.layers.grid !== prev.layers.grid) updateGrid(m, s)
      if (s.basemap !== prev.basemap || s.theme !== prev.theme) m.setStyle(buildStyle(s.basemap, s.theme))
      if (s.flyTo !== prev.flyTo && s.flyTo) {
        m.flyTo({
          center: s.flyTo.center,
          zoom: s.flyTo.zoom ?? Math.max(m.getZoom(), 16),
          bearing: s.flyTo.bearing,
          pitch: s.flyTo.pitch,
          duration: 1250,
          essential: true,
        })
      }
      if (s.hydrated && !prev.hydrated) {
        m.jumpTo({
          center: s.view.center,
          zoom: s.view.zoom,
          pitch: s.mode === '3d' ? 58 : 0,
          bearing: s.mode === '3d' ? (s.view.bearing || -22) : 0,
        })
      }
      if (s.selectedId !== prev.selectedId) {
        const obj = s.selectedId ? s.objects.find((o) => o.id === s.selectedId) : null
        if (obj) showPopup(obj)
        else {
          popupRef.current?.remove()
          popupRef.current = null
        }
      }
      if (s.theme !== undefined) {
        map.getCanvas().style.cursor = DRAW_TOOLS.includes(s.tool) ? 'crosshair' : 'grab'
      }
    })

    // initial 3D mode
    if (variant === 'pip') {
      // pip always renders the perspective view
    } else if (st.mode === '3d') {
      window.setTimeout(() => syncMode(map, useStore.getState(), true), 600)
    }

    return () => {
      unsub()
      window.clearTimeout(osmTimer)
      readyRef.current = false
      if (variant === 'pip') mapRegistry.pip = null
      else mapRegistry.main = null
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* basemap health check — a blocked / key-protected provider must not leave an empty map */
  useEffect(() => {
    if (variant !== 'main') return
    if (basemap === 'osm' || basemap === 'blank') return
    let alive = true
    const { view, setBasemap, toast } = useStore.getState()
    void isBasemapReachable(basemap, view.center, view.zoom).then((reachable) => {
      if (!alive || reachable) return
      setBasemap('osm')
      toast('warn', 'Подложка недоступна — включена OSM')
    })
    return () => {
      alive = false
    }
  }, [basemap, variant])

  /* pulse animation for the selected marker (idea 21) */
  useEffect(() => {
    if (variant !== 'main') return
    let raf = 0
    let last = 0
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick)
      const map = mapRef.current
      if (!map || !readyRef.current || !map.getLayer('mm-point-ring')) return
      const s = useStore.getState()
      if (!s.settings.animateMarkers || !s.selectedId) return
      if (t - last < 90) return
      last = t
      const phase = (Math.sin(t / 520) + 1) / 2
      try {
        map.setPaintProperty('mm-point-ring', 'circle-radius', 16 + phase * 8)
        map.setPaintProperty('mm-point-ring', 'circle-stroke-opacity', 0.45 + phase * 0.45)
        // animated protected / restricted borders (idea 64)
        map.setPaintProperty('mm-poly-outline', 'line-opacity', 0.72 + phase * 0.28)
        map.setPaintProperty('mm-poly-outline-dash', 'line-opacity', 0.45 + phase * 0.55)
        map.setPaintProperty('mm-fence-3d', 'fill-extrusion-opacity', 0.82 + phase * 0.16)
      } catch {
        /* ignore */
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [variant])

  const showPopup = (obj: MapObject) => {
    const map = mapRef.current
    if (!map || variant !== 'main') return
    const coords = centroidOf(obj.geometry)
    popupRef.current?.remove()
    const popup = new Popup({
      offset: 18,
      closeButton: true,
      closeOnClick: false,
      maxWidth: '320px',
      className: 'mm-popup',
    })
      .setLngLat(coords)
      .setHTML(popupHtml(obj, getCategory(obj.category).labelRu, coords))
      .addTo(map)
    popupRef.current = popup
    popup.on('close', () => {
      if (popupRef.current === popup) popupRef.current = null
    })
    window.setTimeout(() => {
      const el = popup.getElement()
      el?.querySelectorAll('[data-action="open"]').forEach((btn) =>
        btn.addEventListener('click', () => {
          useStore.getState().select(obj.id)
          useStore.setState({ bottomOpen: false })
          popup.remove()
        }),
      )
    }, 30)
  }

  const addPointAt = (lngLat: [number, number], s: ReturnType<typeof useStore.getState>, radius = 0) => {
    const cat = getCategory(s.pending.category === 'poi' && radius ? 'poi' : s.pending.category)
    const obj = s.addObject({
      type: 'point',
      category: cat.id,
      geometry: { type: 'Point', coordinates: lngLat } as Point,
      icon: cat.icon,
      color: s.pending.color ?? cat.color,
      name: '',
      radius: radius || s.pending.radius || 0,
      properties: {},
    })
    s.toast('ok', radius ? 'Зона-буфер создана' : 'Точка добавлена — задайте имя справа')
    showPopup(obj)
  }

  /* ---------------- context menu actions ---------------- */
  const copyCoords = async () => {
    if (!menu) return
    const text = formatCoords(menu.lngLat[0], menu.lngLat[1])
    try {
      await navigator.clipboard.writeText(text)
      useStore.getState().toast('ok', `Скопировано: ${text}`)
    } catch {
      useStore.getState().toast('warn', text)
    }
    setMenu(null)
  }

  const reverseHere = async () => {
    if (!menu) return
    useStore.getState().toast('info', 'Ищем адрес…')
    const addr = await reverseGeocode(menu.lngLat[0], menu.lngLat[1])
    useStore.getState().toast(addr ? 'ok' : 'warn', addr || 'Адрес не найден')
    setMenu(null)
  }

  const dropHere = () => {
    if (!menu) return
    const s = useStore.getState()
    const cat = getCategory(s.pending.category)
    s.addObject({
      type: 'point',
      category: cat.id,
      geometry: { type: 'Point', coordinates: menu.lngLat },
      icon: cat.icon,
      color: s.pending.color ?? cat.color,
      name: 'Новая точка',
    })
    s.toast('ok', 'Точка добавлена')
    setMenu(null)
  }

  const startRouteHere = () => {
    if (!menu) return
    const s = useStore.getState()
    s.setTool('route')
    s.setRoutePoints([menu.lngLat])
    s.toast('info', 'Кликните точку назначения')
    setMenu(null)
  }

  return (
    <div className={variant === 'pip' ? 'absolute inset-0' : 'absolute inset-0'}>
      <div ref={containerRef} className="absolute inset-0" />
      {fatal && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div className="panel-solid max-w-[420px] p-5 text-center">
            <div className="mb-1 text-[13.5px] font-semibold">Карта не запустилась</div>
            <p className="muted mb-2 text-[11.5px] leading-relaxed">
              Похоже, браузер не даёт доступ к WebGL. Включите аппаратное ускорение или откройте приложение в
              другом браузере — разметка при этом сохраняется локально.
            </p>
            <pre className="rounded-lg bg-black/40 p-2 text-left font-mono text-[10px] text-[#f87171]">{fatal}</pre>
          </div>
        </div>
      )}
      {menu && (
        <>
          <div className="absolute inset-0 z-20" onClick={() => setMenu(null)} onContextMenu={(e) => e.preventDefault()} />
          <div
            className="panel-solid z-30 w-[248px] animate-floatIn overflow-hidden p-1.5"
            style={{
              position: 'absolute',
              // keep the whole menu on screen, whatever the tap position
              left: Math.max(8, Math.min(menu.x, (containerRef.current?.clientWidth ?? 400) - 264)),
              top: Math.max(8, Math.min(menu.y, (containerRef.current?.clientHeight ?? 600) - 320)),
            }}
          >
            <div className="muted px-2.5 py-1.5 font-mono text-[10.5px]">
              {formatCoords(menu.lngLat[0], menu.lngLat[1])}
            </div>
            <MenuItem label="Копировать координаты" hint="⌘C" onClick={copyCoords} />
            <MenuItem label="Что здесь? (адрес)" onClick={reverseHere} />
            <MenuItem label="Поставить точку здесь" onClick={dropHere} />
            <MenuItem label="Маршрут отсюда" onClick={startRouteHere} />
            {menu.objectId && (
              <>
                <div className="my-1 h-px bg-[rgb(var(--line)/0.1)]" />
                <MenuItem
                  label="Открыть свойства"
                  onClick={() => {
                    useStore.getState().select(menu.objectId!)
                    setMenu(null)
                  }}
                />
                <MenuItem
                  label="Дублировать объект"
                  onClick={() => {
                    useStore.getState().duplicateObject(menu.objectId!)
                    setMenu(null)
                  }}
                />
                <MenuItem
                  danger
                  label="Удалить объект"
                  onClick={() => {
                    useStore.getState().deleteObject(menu.objectId!)
                    setMenu(null)
                  }}
                />
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function MenuItem({ label, hint, onClick, danger }: { label: string; hint?: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[12.5px] transition-colors hover:bg-[rgb(var(--line)/0.09)] ${
        danger ? 'text-danger' : ''
      }`}
    >
      <span>{label}</span>
      {hint && <span className="muted font-mono text-[10px]">{hint}</span>}
    </button>
  )
}

function escapeHtml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[c] as string)
}
