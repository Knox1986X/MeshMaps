import { Suspense, lazy, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { TopBar } from '@/components/TopBar'
import { Toolbar } from '@/components/Toolbar'
import { PropertiesPanel } from '@/components/PropertiesPanel'
import { ObjectListPanel } from '@/components/ObjectListPanel'
import { MapChrome } from '@/components/MapChrome'
import { DraftBar, EmptyHint, Toasts } from '@/components/Overlays'
import { Modals } from '@/components/Modals'
import { OfflineModal } from '@/components/OfflineModal'
import { Icon } from '@/components/Icon'
import { usePersistence } from '@/hooks/usePersistence'
import { useHotkeys } from '@/hooks/useHotkeys'
import { useFileDrop } from '@/hooks/useFileDrop'
import { useStore } from '@/store/useStore'
import { mapRegistry } from '@/map/registry'

// The map engine (maplibre-gl) is the heaviest dependency: load it in its own chunk so the
// chrome, panels and stored data appear immediately on a cold start.
const MapCanvas = lazy(() => import('@/components/MapCanvas'))

export default function App() {
  usePersistence()
  useHotkeys()
  const { over } = useFileDrop()
  const hydrated = useStore((s) => s.hydrated)
  const split = useStore((s) => s.split)
  const toggleSplit = useStore((s) => s.toggleSplit)

  useEffect(() => {
    if (!split) return
    const t = setTimeout(() => mapRegistry.pip?.resize(), 320)
    return () => clearTimeout(t)
  }, [split])

  return (
    <div className="relative h-full w-full overflow-hidden bg-[rgb(var(--bg))]">
      <Suspense fallback={<div className="absolute inset-0 bg-[rgb(var(--bg))]" />}>
        <MapCanvas />
      </Suspense>
      <EmptyHint />
      <TopBar />
      <Toolbar />
      <PropertiesPanel />
      <ObjectListPanel />
      <DraftBar />
      <MapChrome />
      <Toasts />
      <Modals />
      <OfflineModal />

      {/* 3D preview window — 2D/3D comparison (idea 37) */}
      <AnimatePresence>
        {split && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
            className="pointer-events-auto absolute left-1/2 top-[64px] z-20 hidden w-[320px] -translate-x-1/2 overflow-hidden rounded-2xl border border-[rgb(var(--line)/0.14)] shadow-panel md:block"
            style={{ height: 208 }}
          >
            <Suspense fallback={null}>
              <MapCanvas variant="pip" />
            </Suspense>
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-2 py-1.5">
              <span className="rounded-md bg-black/45 px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wider text-white/85 backdrop-blur">
                3D-превью
              </span>
              <button
                className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-md bg-black/45 text-white/85 backdrop-blur hover:bg-black/65"
                onClick={toggleSplit}
                aria-label="Закрыть превью"
              >
                <Icon name="close" size={12} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* drag & drop overlay */}
      <AnimatePresence>
        {over && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-3 z-[70] flex items-center justify-center rounded-3xl border-2 border-dashed border-[rgb(var(--accent)/0.7)] bg-[rgb(var(--accent)/0.12)] backdrop-blur-sm"
          >
            <div className="panel-solid flex flex-col items-center gap-2 px-6 py-5 text-center">
              <Icon name="upload" size={26} className="text-[rgb(var(--accent-soft))]" />
              <div className="text-[13px] font-semibold">Отпустите файл</div>
              <div className="muted text-[11px]">GeoJSON · GPX · изображение к выбранному объекту</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* boot splash */}
      <AnimatePresence>
        {!hydrated && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-[rgb(var(--bg))]"
          >
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#4f8cff] to-[#a3e635] shadow-glow">
              <svg viewBox="0 0 64 64" className="h-9 w-9">
                <path d="M14 46 L26 18 L38 46 L32 46 L26 32 L20 46 Z" fill="#0b0f16" />
              </svg>
            </div>
            <div className="text-[13px] font-semibold tracking-tight">MeshMaps</div>
            <div className="muted text-[11px]">загрузка локальной базы…</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
