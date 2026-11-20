import { useEffect } from 'react'
import { defaultSettings, useStore } from '@/store/useStore'
import { kvGet, kvSet, loadObjects, replaceAll } from '@/db/db'
import { seedObjects } from '@/db/seed'
import { parseShareHash } from '@/utils/share'
import type { BaseMapId, LayerVisibility, MapViewState, ViewMode } from '@/types'

export const defaultLayers: LayerVisibility = {
  basemap: true,
  buildings: true,
  osm3d: true,
  objects: true,
  labels: true,
  clusters: true,
  heatmap: false,
  grid: false,
  hillshade: false,
  terrain: true,
  shadows: true,
  buffers: true,
}

/** Load from IndexedDB on boot, then keep everything in sync. */
export function usePersistence() {
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [objects, theme, view, settings, layers, basemap, mode, seeded] = await Promise.all([
          loadObjects(),
          kvGet<'dark' | 'light'>('theme', 'dark'),
          kvGet<MapViewState | null>('view', null),
          kvGet('settings', defaultSettings),
          kvGet<LayerVisibility>('layers', defaultLayers),
          kvGet<BaseMapId>('basemap', 'carto-dark'),
          kvGet<ViewMode>('mode', '2d'),
          kvGet<boolean>('seeded', false),
        ])
        if (cancelled) return

        const share = parseShareHash(location.hash)
        const finalTheme = share.theme ?? theme
        document.documentElement.dataset.theme = finalTheme

        let finalObjects = objects
        if (!objects.length && !seeded) {
          finalObjects = seedObjects()
          await replaceAll(finalObjects)
          await kvSet('seeded', true)
        }

        useStore.getState().hydrate(finalObjects, {
          theme: finalTheme,
          view: { ...(view ?? useStore.getState().view), ...(share.view ?? {}) },
          settings: { ...defaultSettings, ...(settings ?? {}) },
          layers: { ...defaultLayers, ...(layers ?? {}) },
          basemap: (share.basemap as BaseMapId) ?? basemap,
          mode: share.mode ?? mode,
          selectedId: share.selectedId ?? null,
        })
      } catch (err) {
        console.error('hydrate failed', err)
        document.documentElement.dataset.theme = 'dark'
        useStore.getState().hydrate(seedObjects(), {})
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  /* autosave */
  useEffect(() => {
    let timer: number | undefined
    const unsub = useStore.subscribe((s, p) => {
      if (!s.hydrated) return
      const relevant =
        s.objects !== p.objects ||
        s.settings !== p.settings ||
        s.view !== p.view ||
        s.theme !== p.theme ||
        s.layers !== p.layers ||
        s.basemap !== p.basemap ||
        s.mode !== p.mode
      if (!relevant) return
      window.clearTimeout(timer)
      timer = window.setTimeout(async () => {
        if (typeof indexedDB === 'undefined') {
          useStore.getState().setSaveState('saved')
          return
        }
        try {
          if (s.objects !== p.objects && s.settings.autoSave) await replaceAll(s.objects)
          await Promise.all([
            kvSet('settings', s.settings),
            kvSet('view', s.view),
            kvSet('theme', s.theme),
            kvSet('layers', s.layers),
            kvSet('basemap', s.basemap),
            kvSet('mode', s.mode),
          ])
          useStore.getState().setSaveState('saved')
        } catch (err) {
          console.error('save failed', err)
          useStore.getState().toast('error', 'Ошибка сохранения в IndexedDB')
        }
      }, 850)
    })
    return () => {
      window.clearTimeout(timer)
      unsub()
    }
  }, [])
}
