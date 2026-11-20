import { useEffect, useMemo, useState } from 'react'
import { useStore } from '@/store/useStore'
import { mapRegistry } from '@/map/registry'
import { Modal, Segmented } from './ui'
import { Icon } from './Icon'
import {
  ALL_PACKS,
  CITIES,
  REGIONS,
  customPack,
  estimateBytes,
  estimateTiles,
  formatBytes,
  type PackDef,
} from '@/offline/catalog'
import { storageUsage } from '@/offline/storage'

type Tab = 'city' | 'region' | 'view'

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgb(var(--line)/0.14)]">
      <div
        className="h-full rounded-full bg-[rgb(var(--accent))] transition-[width] duration-200"
        style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
      />
    </div>
  )
}

function PackRowView({ def, compact }: { def: PackDef; compact?: boolean }) {
  const pack = useStore((s) => s.packs.find((p) => p.id === def.id))
  const progress = useStore((s) => s.packProgress[def.id])
  const downloadPackNow = useStore((s) => s.downloadPackNow)
  const cancelPackDownload = useStore((s) => s.cancelPackDownload)
  const removePack = useStore((s) => s.removePack)

  const tiles = estimateTiles(def)
  const bytes = estimateBytes(def)
  const pct = progress ? progress.done / Math.max(1, progress.total) : 0

  return (
    <div className="rounded-xl border border-[rgb(var(--line)/0.08)] p-2.5" data-mm-pack={def.id}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-medium">{def.label}</div>
          <div className="muted mt-0.5 truncate text-[10.5px]">
            {pack
              ? `Готово · ${formatBytes(pack.bytes)} · z${pack.minZoom}–${pack.maxZoom}`
              : `${tiles} тайлов · ~${formatBytes(bytes)} · z${def.minZoom}–${def.maxZoom}`}
            {!compact && def.subtitle ? ` · ${def.subtitle}` : ''}
          </div>
        </div>
        {progress ? (
          <button className="btn shrink-0 !px-2.5 !py-1.5 !text-[11px]" onClick={cancelPackDownload}>
            Отменить
          </button>
        ) : pack ? (
          <button
            className="btn shrink-0 !px-2.5 !py-1.5 !text-[11px] text-danger"
            onClick={() => void removePack(def.id)}
          >
            <Icon name="trash" size={12} /> Удалить
          </button>
        ) : (
          <button
            className="btn shrink-0 !px-2.5 !py-1.5 !text-[11px]"
            onClick={() => void downloadPackNow(def)}
          >
            <Icon name="download" size={12} /> Скачать
          </button>
        )}
      </div>
      {progress && (
        <div className="mt-2">
          <ProgressBar value={pct} />
          <div className="muted mt-1 flex items-center justify-between text-[10px]">
            <span>
              {progress.done} / {progress.total} тайлов
            </span>
            <span>{Math.round(pct * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  )
}

export function OfflineModal() {
  const open = useStore((s) => s.offlineOpen)
  const setOpen = useStore((s) => s.setOfflineOpen)
  const packs = useStore((s) => s.packs)
  const refreshPacks = useStore((s) => s.refreshPacks)
  const packError = useStore((s) => s.packError)
  const [tab, setTab] = useState<Tab>('city')
  const [query, setQuery] = useState('')
  const [usage, setUsage] = useState({ used: 0, quota: 0 })

  useEffect(() => {
    if (!open) return
    void refreshPacks()
    void storageUsage().then(setUsage)
  }, [open, refreshPacks])

  const viewPack = useMemo(() => {
    const map = mapRegistry.main
    if (!map) return null
    const b = map.getBounds()
    return customPack([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], map.getZoom())
  }, [open])

  const list = useMemo(() => {
    const base = tab === 'city' ? CITIES : tab === 'region' ? REGIONS : viewPack ? [viewPack] : []
    const q = query.trim().toLowerCase()
    return q ? base.filter((p) => p.label.toLowerCase().includes(q)) : base
  }, [tab, query, viewPack])

  const offlineTotal = packs.reduce((sum, p) => sum + p.bytes, 0)

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="Офлайн-карты"
      subtitle="Скачайте город или область — карта откроется без интернета, данные останутся на устройстве."
      width={680}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Segmented
          size="sm"
          value={tab}
          onChange={(v) => setTab(v as Tab)}
          options={[
            { id: 'city', label: 'Города', icon: 'point' },
            { id: 'region', label: 'Области', icon: 'globe' },
            { id: 'view', label: 'Текущий вид', icon: 'target' },
          ]}
        />
        <div className="relative min-w-0 flex-1">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти город или область…"
            className="field !h-8 !text-[11.5px]"
          />
        </div>
      </div>

      {tab === 'view' && !viewPack && (
        <div className="muted mb-3 text-[11px]">Карта ещё не готова — откройте её и повторите.</div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {list.map((def) => (
          <PackRowView key={def.id} def={def} compact={tab !== 'view'} />
        ))}
      </div>

      {!list.length && <div className="muted py-6 text-center text-[11.5px]">Ничего не найдено</div>}

      {packError && (
        <div className="mt-3 rounded-xl border border-[rgb(var(--danger)/0.35)] bg-[rgb(var(--danger)/0.08)] px-3 py-2 text-[11px] text-danger">
          {packError}
        </div>
      )}

      <div className="muted mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[rgb(var(--line)/0.08)] pt-3 text-[10.5px]">
        <span>
          Офлайн: {packs.length} наборов · {formatBytes(offlineTotal)}
        </span>
        <span>
          Занято хранилищем: {formatBytes(usage.used)}
          {usage.quota ? ` из ${formatBytes(usage.quota)}` : ''}
        </span>
      </div>
      <p className="muted mt-2 text-[10px] leading-snug">
        Тайлы — OpenFreeMap (данные © OpenStreetMap contributors, ODbL). Скачиваются только выбранные
        области; остальная карта грузится из сети. Набор можно удалить в любой момент — разметка не
        затрагивается.
      </p>
    </Modal>
  )
}

export const OFFLINE_PACK_COUNT = ALL_PACKS.length
export const OFFLINE_ESTIMATE = estimateBytes
