import { useEffect } from 'react'
import { useStore } from '@/store/useStore'
import type { ToolId } from '@/types'
import { draftToObject } from '@/drawing'
import { getCategory } from '@/icons/categories'
import { exportGeoJSON } from '@/features/actions'

const TOOL_KEYS: Record<string, ToolId> = {
  v: 'select',
  p: 'point',
  t: 'line',
  g: 'polygon',
  b: 'building',
  f: 'fence',
  c: 'buffer',
  m: 'measure-distance',
  a: 'measure-area',
  r: 'route',
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

export function finishDraftNow() {
  const st = useStore.getState()
  const d = st.draft
  if (!d) return
  const cat = getCategory(st.pending.category)
  const obj = draftToObject(d, {
    category: st.pending.category,
    color: st.pending.color ?? cat.color,
    icon: cat.icon,
    height: st.pending.height,
    buildingLevels: st.pending.buildingLevels,
    fenceType: st.pending.fenceType,
    fenceStyle: st.pending.fenceStyle,
  })
  if (!obj) {
    st.toast('warn', d.kind === 'line' ? 'Нужно минимум 2 точки' : 'Нужно минимум 3 точки')
    return
  }
  obj.name = obj.name || `${cat.labelRu}`
  if (obj.type === 'line') obj.properties = { ...obj.properties, стиль: st.pending.lineStyle === 'dashed' ? 'dashed' : 'solid' }
  if (obj.type === 'fence') {
    obj.fenceOpacity = 0.92
    obj.category = 'fence'
  }
  st.addObjects([obj], `add:${obj.type}`)
  st.setTool('select')
  st.select(obj.id)
  st.toast('ok', 'Объект создан')
}

export function useHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useStore.getState()
      const meta = e.metaKey || e.ctrlKey

      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        document.getElementById('mm-search')?.focus()
        return
      }
      if (meta && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) st.redo()
        else st.undo()
        return
      }
      if (meta && e.key.toLowerCase() === 's') {
        e.preventDefault()
        exportGeoJSON()
        return
      }
      if (meta && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        if (st.selectedId) st.duplicateObject(st.selectedId)
        return
      }
      if (meta) return

      if (isTyping(e.target)) {
        if (e.key === 'Escape') (e.target as HTMLElement).blur()
        return
      }

      if (e.key === 'Escape') {
        st.setModal(null)
        if (st.tool !== 'select') st.setTool('select')
        else st.select(null)
        return
      }

      if (e.key === 'Enter') {
        if (st.draft) {
          e.preventDefault()
          finishDraftNow()
        }
        return
      }

      if (e.key === 'Backspace') {
        e.preventDefault()
        if (st.draft && st.draft.coords.length) st.popDraftPoint()
        else if (st.selectedId) st.deleteObject(st.selectedId)
        return
      }
      if (e.key === 'Delete') {
        if (st.selectedId) st.deleteObject(st.selectedId)
        return
      }

      const k = e.key.toLowerCase()
      if (k === '2') return st.setMode('2d')
      if (k === '3') return st.setMode('3d')
      if (k === 'l') return st.setBottomOpen(!st.bottomOpen)
      if (k === 'h') return st.toggleLayer('heatmap')
      if (k === 'q') return st.toggleLayer('hillshade')
      if (k === 'n') return st.toggleLayer('grid')
      if (k === 't' && e.shiftKey) return
      if (k === '?') return st.setModal('shortcuts')

      const tool = TOOL_KEYS[k]
      if (tool) {
        st.setTool(tool)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
