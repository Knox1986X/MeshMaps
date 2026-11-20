/**
 * Device performance profile.
 *
 * Phones are not desktops: a 1080×2400 canvas at DPR 2 is ~10 M pixels, `backdrop-filter`
 * costs a full-surface blur on every frame over a WebGL canvas, and `preserveDrawingBuffer`
 * forces an extra framebuffer copy per frame. This module decides once (and reacts to the
 * user's choice in settings) whether the app should run in "lite" mode and hands every
 * subsystem the numbers it needs, so there is a single source of truth instead of hints
 * scattered across components.
 */

export type PerfMode = 'auto' | 'lite' | 'full'

export interface DeviceEnv {
  dpr: number
  cores: number
  /** navigator.deviceMemory, GB; 0 when unknown */
  memory: number
  coarsePointer: boolean
  width: number
  reducedMotion: boolean
}

export interface PerfProfile {
  lite: boolean
  /** render scale handed to MapLibre */
  dpr: number
  antialias: boolean
  fadeDuration: number
  /** keep a copy of the framebuffer for PNG export (costly on mobile GPUs) */
  preserveDrawingBuffer: boolean
  maxTileCacheSize: number
  refreshExpiredTiles: boolean
  /** live hover highlighting + cursor queries (mouse only, never on touch) */
  hover: boolean
  /** CSS backdrop blur on panels */
  blur: boolean
  /** terrain by default: DEM tiles are heavy on mobile */
  terrainByDefault: boolean
  /** how often the coordinate readout follows the pointer, ms */
  cursorThrottle: number
}

export const DEVICE_UNKNOWN: DeviceEnv = {
  dpr: 1,
  cores: 8,
  memory: 8,
  coarsePointer: false,
  width: 1280,
  reducedMotion: false,
}

/** Reads the environment once; safe on the server and in tests. */
export function readDeviceEnv(): DeviceEnv {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return { ...DEVICE_UNKNOWN }
  const nav = navigator as Navigator & { deviceMemory?: number }
  const mq = (q: string) => (typeof window.matchMedia === 'function' ? window.matchMedia(q).matches : false)
  return {
    dpr: window.devicePixelRatio || 1,
    cores: nav.hardwareConcurrency || 4,
    memory: nav.deviceMemory || 0,
    coarsePointer: mq('(pointer: coarse)'),
    width: window.innerWidth || 1280,
    reducedMotion: mq('(prefers-reduced-motion: reduce)'),
  }
}

/**
 * "auto" leans to lite on anything that smells like a phone: touch input, ≤4 cores,
 * ≤4 GB RAM, or a narrow viewport. A desktop window that is simply narrow only loses the
 * blur, and the user can always force the mode in settings.
 */
export function isLiteDevice(env: DeviceEnv): boolean {
  return env.coarsePointer || env.cores <= 4 || (env.memory > 0 && env.memory <= 4) || env.width <= 820
}

export function perfFor(mode: PerfMode, env: DeviceEnv = DEVICE_UNKNOWN): PerfProfile {
  const lite = mode === 'lite' ? true : mode === 'full' ? false : isLiteDevice(env)
  const dprCap = lite ? 1.5 : 2
  return {
    lite,
    dpr: Math.max(1, Math.min(env.dpr || 1, dprCap)),
    antialias: !lite,
    fadeDuration: lite ? 0 : 140,
    preserveDrawingBuffer: !lite,
    maxTileCacheSize: lite ? 48 : 128,
    refreshExpiredTiles: !lite,
    hover: !lite && !env.coarsePointer,
    blur: !lite,
    terrainByDefault: !lite,
    cursorThrottle: lite ? 220 : 90,
  }
}

/* ------------------------------------------------------------------ */
/* module-level cache: the map constructor cannot wait for React state */
/* ------------------------------------------------------------------ */

let cache: PerfProfile | null = null
let cacheKey = ''

export function currentPerf(): PerfProfile {
  if (!cache) cache = perfFor('auto', readDeviceEnv())
  return cache
}

/**
 * Recomputes the profile for a settings change and mirrors it onto `<html data-perf>` so
 * plain CSS can drop the expensive effects. Returns the profile it settled on.
 */
export function applyPerf(mode: PerfMode, env: DeviceEnv = readDeviceEnv()): PerfProfile {
  const next = perfFor(mode, env)
  const key = `${mode}:${next.lite}:${next.dpr}`
  cache = next
  if (key !== cacheKey && typeof document !== 'undefined') {
    cacheKey = key
    document.documentElement.dataset.perf = next.lite ? 'lite' : 'full'
    document.documentElement.dataset.perfMode = mode
  }
  return next
}

/** Test hook: forget the cached profile. */
export function resetPerfCache() {
  cache = null
  cacheKey = ''
}
