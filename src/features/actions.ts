import { useStore, createObject, objectStats } from '@/store/useStore'
import { getCategory } from '@/icons/categories'
import { mapRegistry } from '@/map/registry'
import { currentPerf } from '@/perf'
import {
  formatArea,
  formatDistance,
  gpxFromObjects,
  objectsToGeoJSON,
  parseGpx,
} from '@/utils/geo'
import type { Feature, MapObject } from '@/types'
import { buildShareUrl } from '@/utils/share'
import { isNativeShell, presentFileFallback } from '@/utils/nativeSave'
import { fetchOsmObjects } from '@/api'

/* ------------------------------------------------------------------ */
/* download helpers                                                    */
/* ------------------------------------------------------------------ */

export function download(name: string, data: BlobPart, mime = 'application/octet-stream') {
  const blob = new Blob([data], { type: mime })
  // Android/iOS shell: no download manager in the WebView, so show the payload instead.
  // TODO: full version — @capacitor/filesystem + @capacitor/share plugin.
  if (isNativeShell()) {
    void presentFileFallback(name, blob, mime)
    useStore.getState().toast('info', 'Файл готов — сохраните его из панели')
    return
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')

/* ------------------------------------------------------------------ */
/* export                                                              */
/* ------------------------------------------------------------------ */

export function exportGeoJSON(onlyVisible = false) {
  const st = useStore.getState()
  const fc = objectsToGeoJSON(st.objects)
  if (!onlyVisible) {
    download(`meshmaps-${stamp()}.geojson`, JSON.stringify(fc, null, 2), 'application/geo+json')
    st.toast('ok', `Экспортировано ${st.objects.length} объектов в GeoJSON`)
    return
  }
  download(`meshmaps-${stamp()}.geojson`, JSON.stringify(fc, null, 2), 'application/geo+json')
}

export function exportGPX() {
  const st = useStore.getState()
  download(`meshmaps-${stamp()}.gpx`, gpxFromObjects(st.objects), 'application/gpx+xml')
  st.toast('ok', 'GPX выгружен (точки + треки)')
}

export function exportPNG(withLegend = true) {
  const map = mapRegistry.main
  const st = useStore.getState()
  if (!map) return
  // Lite mode does not keep a framebuffer copy (it costs a full copy per frame on phones),
  // so we ask for one fresh frame and read the canvas inside its render callback.
  if (!currentPerf().preserveDrawingBuffer) {
    let fired = false
    const once = () => {
      if (fired) return
      fired = true
      exportPNGNow(withLegend)
    }
    map.once('render', once)
    map.triggerRepaint()
    window.setTimeout(() => {
      if (fired) return
      fired = true
      exportPNGNow(withLegend)
    }, 1200)
    return
  }
  exportPNGNow(withLegend)
}

function exportPNGNow(withLegend = true) {
  const map = mapRegistry.main
  const st = useStore.getState()
  if (!map) return
  const mapCanvas = map.getCanvas()
  const scale = 1
  const out = document.createElement('canvas')
  out.width = mapCanvas.width * scale
  out.height = mapCanvas.height * scale
  const ctx = out.getContext('2d')
  if (!ctx) return
  ctx.drawImage(mapCanvas, 0, 0, out.width, out.height)

  const finish = () => {
    out.toBlob((blob) => {
      if (blob) download(`meshmaps-${stamp()}.png`, blob, 'image/png')
    }, 'image/png')
    st.toast('ok', 'Снимок карты сохранён')
  }

  if (!withLegend) return finish()

  // ---- compose legend + attribution ----
  const used = [...new Set(st.objects.map((o) => o.category))]
  const labels = used.map((id) => getCategory(id))
  const rowH = 22
  const pad = 14
  const legendW = 208
  const legendH = pad * 2 + 26 + labels.length * rowH
  const x = 18
  const y = out.height - legendH - 18

  const dpr = out.width / (map.getCanvas().clientWidth || out.width)
  ctx.save()
  ctx.fillStyle = 'rgba(11,15,22,0.78)'
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.lineWidth = 1 * dpr
  const r = 14 * dpr
  roundRect(ctx, x, y, legendW * dpr, legendH * dpr, r)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#e8edf6'
  ctx.font = `600 ${11 * dpr}px Inter, sans-serif`
  ctx.fillText('MESHMAPS · ЛЕГЕНДА', x + pad * dpr, y + 18 * dpr)
  labels.forEach((cat, i) => {
    const cy = y + (pad + 22 + i * rowH) * dpr
    ctx.beginPath()
    ctx.arc(x + (pad + 4) * dpr, cy + 3 * dpr, 4 * dpr, 0, Math.PI * 2)
    ctx.fillStyle = cat.color
    ctx.fill()
    ctx.fillStyle = 'rgba(232,237,246,.9)'
    ctx.font = `400 ${10.5 * dpr}px Inter, sans-serif`
    ctx.fillText(cat.labelRu, x + (pad + 16) * dpr, cy + 7 * dpr)
  })
  ctx.fillStyle = 'rgba(232,237,246,.5)'
  ctx.font = `400 ${9 * dpr}px Inter, sans-serif`
  ctx.fillText(
    `© OpenStreetMap contributors · ${new Date().toLocaleDateString('ru-RU')}`,
    x + pad * dpr,
    y + legendH * dpr - 6 * dpr,
  )
  ctx.restore()
  finish()
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/* ------------------------------------------------------------------ */
/* import                                                              */
/* ------------------------------------------------------------------ */

export async function importFile(file: File): Promise<void> {
  const st = useStore.getState()
  const name = file.name.toLowerCase()
  try {
    if (name.endsWith('.geojson') || name.endsWith('.json')) {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const features: Feature[] =
        parsed.type === 'FeatureCollection' ? parsed.features : parsed.type === 'Feature' ? [parsed] : []
      const objects: MapObject[] = features.map((f) => featureToObject(f))
      st.addObjects(objects, 'import-geojson')
      st.toast('ok', `Импортировано ${objects.length} объектов из GeoJSON`)
      return
    }
    if (name.endsWith('.gpx')) {
      const text = await file.text()
      const items = parseGpx(text)
      const objects = items.map((it) =>
        createObject(
          {
            type: it.geometry.type === 'Point' ? 'point' : 'line',
            category: it.geometry.type === 'Point' ? 'poi' : 'trail',
            name: it.name,
            geometry: it.geometry,
            tags: ['gpx'],
          },
          st.settings.author,
        ),
      )
      st.addObjects(objects, 'import-gpx')
      st.toast('ok', `Импортировано ${objects.length} треков/точек из GPX`)
      return
    }
    if (/\.(png|jpe?g|webp|gif)$/i.test(name)) {
      const reader = new FileReader()
      reader.onload = () => {
        const url = String(reader.result)
        if (st.selectedId) {
          const obj = st.objects.find((o) => o.id === st.selectedId)
          if (obj) {
            st.updateObject(obj.id, { attachments: [...obj.attachments, url] })
            st.toast('ok', 'Фото прикреплено к объекту')
          }
        } else {
          st.toast('warn', 'Выберите объект, чтобы прикрепить фото')
        }
      }
      reader.readAsDataURL(file)
      return
    }
    st.toast('error', 'Поддерживаются GeoJSON, GPX и изображения')
  } catch (err) {
    console.error(err)
    st.toast('error', 'Не удалось прочитать файл')
  }
}

export function featureToObject(f: Feature): MapObject {
  const p = (f.properties ?? {}) as Record<string, unknown>
  const g = f.geometry
  const kind =
    g.type === 'Point' || g.type === 'MultiPoint'
      ? 'point'
      : g.type === 'LineString' || g.type === 'MultiLineString'
        ? 'line'
        : p['fenceType']
          ? 'fence'
          : p['height'] || p['building']
            ? 'building'
            : 'polygon'
  const category = String(p['category'] ?? (kind === 'line' ? 'trail' : kind === 'polygon' ? 'nature' : kind === 'building' ? 'building' : 'poi'))
  const cat = getCategory(category)
  const known = new Set([
    'id', 'type', 'category', 'name', 'description', 'icon', 'color', 'tags', 'attachments',
    'height', 'buildingLevels', 'roofType', 'roofColor', 'wallColor', 'fenceType', 'fenceStyle',
    'fenceOpacity', 'radius', 'rating', 'pinned', 'yearFrom', 'yearTo', 'schedule', 'comments',
    'createdAt', 'updatedAt', 'author', 'customProperties',
  ])
  const props: Record<string, string | number | boolean> = {}
  for (const [k, v] of Object.entries(p)) {
    if (!known.has(k) && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')) props[k] = v
  }
  return createObject({
    type: kind as MapObject['type'],
    category,
    name: String(p['name'] ?? ''),
    description: String(p['description'] ?? ''),
    geometry: g,
    icon: p['icon'] ? String(p['icon']) : cat.icon,
    color: p['color'] ? String(p['color']) : cat.color,
    tags: Array.isArray(p['tags']) ? (p['tags'] as string[]) : [],
    attachments: Array.isArray(p['attachments']) ? (p['attachments'] as string[]) : [],
    height: typeof p['height'] === 'number' ? p['height'] : undefined,
    buildingLevels: typeof p['buildingLevels'] === 'number' ? p['buildingLevels'] : undefined,
    fenceType: p['fenceType'] as MapObject['fenceType'],
    fenceStyle: p['fenceStyle'] as MapObject['fenceStyle'],
    radius: typeof p['radius'] === 'number' ? p['radius'] : 0,
    properties: props,
  })
}

/* ------------------------------------------------------------------ */
/* OSM area import (idea 60)                                          */
/* ------------------------------------------------------------------ */

export async function importOsmArea() {
  const st = useStore.getState()
  const map = mapRegistry.main
  if (!map) return
  const b = map.getBounds()
  if (map.getZoom() < 13.6) {
    st.toast('warn', 'Приблизьте карту (z14+), чтобы скачать небольшой участок OSM')
    return
  }
  st.toast('info', 'Скачиваем объекты OSM через Overpass…')
  try {
    const list = await fetchOsmObjects([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], 240)
    if (!list.length) {
      st.toast('warn', 'В этой области ничего не найдено')
      return
    }
    const objects = list.map((o) =>
      createObject({ ...o, geometry: o.geometry! }, st.settings.author),
    )
    st.addObjects(objects, 'osm-import')
    st.toast('ok', `Импортировано ${objects.length} объектов OSM`)
  } catch {
    st.toast('error', 'Overpass недоступен — попробуйте позже')
  }
}

/* ------------------------------------------------------------------ */
/* share                                                               */
/* ------------------------------------------------------------------ */

export async function copyShareLink() {
  const st = useStore.getState()
  const url = buildShareUrl({
    view: st.view,
    mode: st.mode,
    theme: st.theme,
    basemap: st.basemap,
    selectedId: st.selectedId,
  })
  try {
    await navigator.clipboard.writeText(url)
    st.toast('ok', 'Ссылка на вид скопирована')
  } catch {
    st.toast('warn', url)
  }
}

/* ------------------------------------------------------------------ */
/* printable report (idea 67)                                          */
/* ------------------------------------------------------------------ */

export function openReport() {
  const st = useStore.getState()
  const stats = objectStats(st.objects)
  const rows = st.objects
    .map((o) => {
      const cat = getCategory(o.category)
      return `<tr>
        <td><span class="dot" style="background:${o.color}"></span>${escapeHtml(o.name || '—')}</td>
        <td>${escapeHtml(cat.labelRu)}</td>
        <td>${o.type}</td>
        <td>${o.height ? o.height + ' м' : '—'}</td>
        <td>${escapeHtml(o.tags.join(', '))}</td>
        <td>${new Date(o.updatedAt).toLocaleDateString('ru-RU')}</td>
      </tr>`
    })
    .join('')
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8">
  <title>MeshMaps — отчёт</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:Inter,system-ui,sans-serif;color:#0f172a;margin:36px;}
    h1{font-size:22px;margin:0 0 4px}
    .sub{color:#64748b;font-size:12px;margin-bottom:20px}
    .cards{display:flex;gap:12px;margin-bottom:22px;flex-wrap:wrap}
    .card{border:1px solid #e2e8f0;border-radius:12px;padding:12px 16px;min-width:130px}
    .card b{display:block;font-size:20px}
    .card span{color:#64748b;font-size:11px}
    table{width:100%;border-collapse:collapse;font-size:11.5px}
    th,td{text-align:left;padding:7px 8px;border-bottom:1px solid #eef2f7}
    th{color:#64748b;font-weight:600;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em}
    .dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}
    footer{margin-top:24px;color:#94a3b8;font-size:10.5px}
    @media print{body{margin:12mm}}
  </style></head><body>
  <h1>MeshMaps — отчёт по разметке</h1>
  <div class="sub">Сформирован ${new Date().toLocaleString('ru-RU')} · автор: ${escapeHtml(st.settings.author)}</div>
  <div class="cards">
    <div class="card"><b>${stats.total}</b><span>объектов</span></div>
    <div class="card"><b>${stats.buildings}</b><span>зданий</span></div>
    <div class="card"><b>${stats.fences}</b><span>ограждений</span></div>
    <div class="card"><b>${formatDistance(stats.length)}</b><span>длина линий</span></div>
    <div class="card"><b>${formatArea(stats.area)}</b><span>площадь</span></div>
  </div>
  <table><thead><tr><th>Название</th><th>Категория</th><th>Тип</th><th>Высота</th><th>Теги</th><th>Обновлён</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="6">Нет объектов</td></tr>'}</tbody></table>
  <footer>MeshMaps · данные © OpenStreetMap contributors</footer>
  <script>window.onload=()=>setTimeout(()=>window.print(),350)<\/script>
  </body></html>`
  const win = window.open('', '_blank')
  if (!win) {
    st.toast('warn', 'Разрешите всплывающие окна для отчёта')
    return
  }
  win.document.write(html)
  win.document.close()
}

function escapeHtml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[c] as string)
}
