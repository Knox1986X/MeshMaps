const UI: Record<string, string> = {
  cursor: '<path d="M5.5 3.5 11.8 20l2.2-6.2 6.2-2.2z"/>',
  point: '<circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="8"/>',
  line: '<path d="M3.5 18.5 9 8.5l4.5 6 7-11"/>',
  polygon: '<path d="M12 3.2 20.4 9l-3.2 10.2H6.8L3.6 9z"/>',
  building: '<path d="M4 20.5V7.5l8-4 8 4v13"/><path d="M4 20.5h16"/><path d="M9.5 20.5v-5h5v5"/>',
  fence: '<path d="M3.8 8.8h16.4M3.8 15.2h16.4"/><path d="M7 5.2V20M12 3.6V20M17 5.2V20"/>',
  ruler: '<path d="M3 15.5 15.5 3l5.5 5.5L8.5 21z"/><path d="M6.8 11.8l1.8 1.8M9.8 8.8l1.8 1.8M12.8 5.8l1.8 1.8"/>',
  area: '<path d="M3.5 8V3.5H8M16 3.5h4.5V8M20.5 16v4.5H16M8 20.5H3.5V16"/><path d="M8.5 15.5 15.5 8.5"/>',
  route: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18h6.5a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/>',
  buffer: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2"/><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3"/>',
  undo: '<path d="M9 8H5V4"/><path d="M5.2 8.2A8 8 0 1 1 4.6 15"/>',
  redo: '<path d="M15 8h4V4"/><path d="M18.8 8.2A8 8 0 1 0 19.4 15"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.6"/><path d="M15.6 15.6 21 21"/>',
  layers: '<path d="M12 3.2 3.5 8 12 12.8 20.5 8z"/><path d="M3.5 12.6 12 17.4l8.5-4.8"/><path d="M3.5 16.8 12 21.6l8.5-4.8"/>',
  eye: '<path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  filter: '<path d="M3.5 5.5h17l-6.5 8v6.5l-4-2.2v-4.3z"/>',
  sort: '<path d="M4 7h16M4 12h11M4 17h6"/>',
  download: '<path d="M12 3.5v11"/><path d="M7.5 10.5 12 15l4.5-4.5"/><path d="M4 19.5h16"/>',
  upload: '<path d="M12 20.5v-11"/><path d="M7.5 13.5 12 9l4.5 4.5"/><path d="M4 4.5h16"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6.5" r="2.5"/><circle cx="18" cy="17.5" r="2.5"/><path d="M8.2 10.8 15.8 7.7M8.2 13.2l7.6 3.1"/>',
  camera: '<path d="M3.5 8.5h4l1.5-2.5h6l1.5 2.5h4v11h-17z"/><circle cx="12" cy="13.5" r="3.4"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.2 5.2l1.8 1.8M17 17l1.8 1.8M18.8 5.2 17 7M7 17l-1.8 1.8"/>',
  moon: '<path d="M20 14.2A8.5 8.5 0 0 1 9.8 4 8.6 8.6 0 1 0 20 14.2z"/>',
  cube: '<path d="M12 2.8 20.6 7.4v9.2L12 21.2 3.4 16.6V7.4z"/><path d="M3.4 7.4 12 12l8.6-4.6M12 12v9.2"/>',
  compass: '<circle cx="12" cy="12" r="8.6"/><path d="M15.5 8.5 13.8 13.8 8.5 15.5 10.2 10.2z"/>',
  grid: '<path d="M3.5 3.5h7v7h-7zM13.5 3.5h7v7h-7zM3.5 13.5h7v7h-7zM13.5 13.5h7v7h-7z"/>',
  heat: '<circle cx="8" cy="8" r="2.2"/><circle cx="16.5" cy="7" r="1.6"/><circle cx="11" cy="14.5" r="2.6"/><circle cx="17.5" cy="16" r="1.9"/><circle cx="5.5" cy="17" r="1.4"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  down: '<path d="M6 9.5 12 15.5 18 9.5"/>',
  up: '<path d="M6 14.5 12 8.5 18 14.5"/>',
  left: '<path d="M14.5 6 8.5 12l6 6"/>',
  right: '<path d="M9.5 6l6 6-6 6"/>',
  plus: '<path d="M12 4.5v15M4.5 12h15"/>',
  trash: '<path d="M4.4 6.4h15.2"/><path d="M9.5 6.4V4.4h5v2"/><path d="M6.4 6.4 7.5 20.1h9l1.1-13.7"/><path d="M10.4 10v6.2M13.6 10v6.2"/>',
  copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 5.5h-9a2 2 0 0 0-2 2v9"/>',
  pin: '<path d="M12 21s6.4-6 6.4-10.4A6.4 6.4 0 0 0 5.6 10.6C5.6 15 12 21 12 21z"/><circle cx="12" cy="10.3" r="2.2"/>',
  star: '<path d="M12 3.2 14.6 9.3 21 10 16.3 14.4 17.6 20.8 12 17.5 6.4 20.8 7.7 14.4 3 10 9.4 9.3z"/>',
  settings: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6h.1A1.7 1.7 0 0 0 10 3.05V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v.1c0 .68.4 1.3 1 1.55"/>',
  keyboard: '<rect x="2.6" y="6" width="18.8" height="12" rx="2.6"/><path d="M6.5 10h.01M9.8 10h.01M13.2 10h.01M16.5 10h.01M6.5 13.6h.01M9.8 13.6h.01M13.2 13.6h.01M16.5 13.6h.01M8.5 16.6h7"/>',
  chart: '<path d="M4 20V9M10 20V4M16 20v-7M22 20H2"/>',
  clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.4V12l3.2 2"/>',
  qr: '<rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.4"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1.4"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1.4"/><path d="M14 14h3v3h-3zM20.5 14v3M14 20.5h3M20.5 20.5h.01"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2.6"/><path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7"/>',
  location: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/>',
  target: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  pen: '<path d="M4 20l4.5-1L20 7.5 16.5 4 5 15.5z"/><path d="M14.5 6 18 9.5"/>',
  list: '<path d="M8 6.5h12M8 12h12M8 17.5h12"/><path d="M4 6.5h.01M4 12h.01M4 17.5h.01"/>',
  info: '<circle cx="12" cy="12" r="8.6"/><path d="M12 11v6M12 7.6v.02"/>',
  sparkles: '<path d="M12 3.5 13.6 9 19 10.5 13.6 12 12 17.5 10.4 12 5 10.5 10.4 9z"/><path d="M18.5 16.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  expand: '<path d="M9 3.5H3.5V9M15 3.5h5.5V9M20.5 15v5.5H15M9 20.5H3.5V15"/>',
  shrink: '<path d="M3.5 9H9V3.5M20.5 9H15V3.5M15 20.5V15h5.5M9 20.5V15H3.5"/>',
  panel: '<rect x="3.5" y="4" width="17" height="16" rx="3"/><path d="M14.5 4v16"/>',
  history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.2 4v4.4h4.4"/><path d="M12 8v4.4l3 1.8"/>',
  measure: '<path d="M4 16.5 16.5 4l4 4L8 20.5z"/><path d="M9 11.5l2 2M12 8.5l2 2"/>',
  globe: '<circle cx="12" cy="12" r="8.6"/><path d="M3.4 12h17.2"/><path d="M12 3.4c2.4 2.3 3.6 5.3 3.6 8.6S14.4 18.3 12 20.6C9.6 18.3 8.4 15.3 8.4 12S9.6 5.7 12 3.4z"/>',
  user: '<circle cx="12" cy="8.4" r="3.8"/><path d="M4.6 20.4a7.6 7.6 0 0 1 14.8 0"/>',
  database: '<ellipse cx="12" cy="6" rx="7.5" ry="3"/><path d="M4.5 6v12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6"/><path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3"/>',
  tree: '<path d="M12 21v-4"/><path d="M12 3.5 6.5 11h2.8L5.5 17.4h13L14.7 11h2.8z"/>',
  check: '<path d="M5 12.8 9.7 17.5 19 6.5"/>',
  warn: '<path d="M12 3.8 21.2 19.9H2.8z"/><path d="M12 9.1v4.6M12 16.7v.02"/>',
  car: '<path d="M4.5 16.5v2.2M19.5 16.5v2.2"/><path d="M3.5 16.5v-3.2l2-5h13l2 5v3.2z"/><path d="M6.5 13.2h11"/><circle cx="7.5" cy="16.5" r=".6"/><circle cx="16.5" cy="16.5" r=".6"/>',
  walk: '<circle cx="13.2" cy="4.6" r="1.9"/><path d="M8.8 21l2.4-5.4 2.6 2 .9 3.4"/><path d="M11 15.6 9.4 10.9l3-1.7 2.4 3 2.8 1"/>',
  bike: '<circle cx="6" cy="17" r="3.4"/><circle cx="18" cy="17" r="3.4"/><path d="M9 17h4.5L11 8h3l4 9"/><path d="M9.5 8h3"/>',
}

export type IconName = keyof typeof UI

export function Icon({
  name,
  size = 18,
  strokeWidth = 1.7,
  className,
  filled,
}: {
  name: string
  size?: number
  strokeWidth?: number
  className?: string
  filled?: boolean
}) {
  const d = UI[name] ?? UI.info
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: d }}
    />
  )
}

export const UI_ICONS = UI
