import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from './Icon'

/* ------------------------------------------------------------------ */
/* Popover                                                             */
/* ------------------------------------------------------------------ */

export function Popover({
  trigger,
  children,
  align = 'right',
  width = 260,
  className,
}: {
  trigger: (open: boolean, toggle: () => void) => ReactNode
  children: (close: () => void) => ReactNode
  align?: 'left' | 'right' | 'center'
  width?: number
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      {trigger(open, () => setOpen((v) => !v))}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 0.61, 0.36, 1] }}
            className={`panel-solid absolute top-[calc(100%+8px)] z-50 overflow-hidden p-1.5 ${
              align === 'right' ? 'right-0' : align === 'left' ? 'left-0' : 'left-1/2 -translate-x-1/2'
            } ${className ?? ''}`}
            style={{ width }}
          >
            {children(() => setOpen(false))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

export function IconButton({
  icon,
  label,
  onClick,
  active,
  disabled,
  badge,
  size = 34,
  kbd,
}: {
  icon: string
  label: string
  onClick?: () => void
  active?: boolean
  disabled?: boolean
  badge?: string | number
  size?: number
  kbd?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={kbd ? `${label} · ${kbd}` : label}
      aria-label={label}
      className="btn-ghost group relative"
      style={{ width: size, height: size }}
      data-active={active}
    >
      <span className={active ? 'text-[rgb(var(--accent-soft))]' : 'muted group-hover:text-[rgb(var(--text))]'}>
        <Icon name={icon} size={Math.round(size * 0.52)} />
      </span>
      {badge != null && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[rgb(var(--accent))] px-1 text-[9px] font-semibold text-white">
          {badge}
        </span>
      )}
      {active && (
        <span className="pointer-events-none absolute inset-0 rounded-xl bg-[rgb(var(--accent)/0.16)] ring-1 ring-[rgb(var(--accent)/0.45)]" />
      )}
    </button>
  )
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
}) {
  return (
    <button onClick={() => onChange(!checked)} className="flex items-center gap-2" aria-pressed={checked}>
      <span
        className={`relative h-[18px] w-[32px] rounded-full transition-colors duration-200 ${
          checked ? 'bg-[rgb(var(--accent))]' : 'bg-[rgb(var(--line)/0.18)]'
        }`}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 520, damping: 32 }}
          className="absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow"
          style={{ left: checked ? 16 : 2 }}
        />
      </span>
      {label && <span className="text-[12.5px]">{label}</span>}
    </button>
  )
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  suffix,
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  label?: string
  suffix?: string
}) {
  return (
    <div>
      {label && (
        <div className="mb-1 flex items-center justify-between">
          <span className="muted text-[11px]">{label}</span>
          <span className="font-mono text-[11px]">
            {value}
            {suffix}
          </span>
        </div>
      )}
      <input
        type="range"
        className="w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
}: {
  options: { id: T; label: string; icon?: string }[]
  value: T
  onChange: (v: T) => void
  size?: 'sm' | 'md'
}) {
  return (
    <div className="flex rounded-xl border border-[rgb(var(--line)/0.09)] bg-[rgb(var(--line)/0.05)] p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-[9px] font-medium transition-colors ${
            size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-[12px]'
          } ${value === o.id ? 'text-[rgb(var(--text))]' : 'muted hover:text-[rgb(var(--text))]'}`}
        >
          {value === o.id && (
            <motion.span
              layoutId={`seg-${options.map((x) => x.id).join('')}`}
              className="absolute inset-0 rounded-[9px] bg-[rgb(var(--glass-strong)/0.9)] shadow-sm ring-1 ring-[rgb(var(--line)/0.12)]"
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            />
          )}
          <span className="relative flex items-center gap-1.5">
            {o.icon && <Icon name={o.icon} size={13} />}
            {o.label}
          </span>
        </button>
      ))}
    </div>
  )
}

export function ColorPicker({
  value,
  onChange,
  palette,
}: {
  value: string
  onChange: (c: string) => void
  palette: readonly string[]
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {palette.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          title={c}
          className="relative h-6 w-6 rounded-full transition-transform hover:scale-110"
          style={{ background: c, boxShadow: value === c ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : 'none' }}
        >
          {value === c && (
            <span className="absolute inset-0 flex items-center justify-center text-white">
              <Icon name="check" size={12} strokeWidth={2.6} />
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  return (
    <label className="block">
      <span className="muted mb-1 block text-[11px] font-medium uppercase tracking-wide">{label}</span>
      {children}
      {hint && <span className="muted mt-1 block text-[10.5px]">{hint}</span>}
    </label>
  )
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = 620,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  width?: number
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/45 backdrop-blur-[3px]" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.985 }}
            transition={{ duration: 0.24, ease: [0.22, 0.61, 0.36, 1] }}
            className="panel-solid relative flex max-h-[86vh] w-full flex-col overflow-hidden"
            style={{ maxWidth: width }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[rgb(var(--line)/0.09)] px-5 py-4">
              <div>
                <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
                {subtitle && <p className="muted mt-0.5 text-[11.5px]">{subtitle}</p>}
              </div>
              <button onClick={onClose} className="btn-ghost -mr-1 h-7 w-7 shrink-0" aria-label="Закрыть">
                <Icon name="close" size={15} />
              </button>
            </div>
            <div className="scroll-fade flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer && <div className="border-t border-[rgb(var(--line)/0.09)] px-5 py-3">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Empty({ icon = 'info', title, hint }: { icon?: string; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgb(var(--line)/0.06)]">
        <Icon name={icon} size={19} className="muted" />
      </div>
      <div className="text-[12.5px] font-medium">{title}</div>
      {hint && <div className="muted max-w-[260px] text-[11px]">{hint}</div>}
    </div>
  )
}
