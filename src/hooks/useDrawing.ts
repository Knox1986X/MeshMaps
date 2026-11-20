import { useCallback } from 'react'
import { useStore } from '@/store/useStore'
import { draftToObject } from '@/drawing'
import { getCategory } from '@/icons/categories'

/** Commit / cancel / edit helpers for the active drawing draft. */
export function useDrawing() {
  const draft = useStore((s) => s.draft)
  const tool = useStore((s) => s.tool)
  const pending = useStore((s) => s.pending)
  const measure = useStore((s) => s.measure)

  const cancel = useCallback(() => {
    useStore.getState().setTool('select')
  }, [])

  const finish = useCallback(() => {
    const st = useStore.getState()
    const d = st.draft
    if (!d) return null
    if (d.kind === 'measure-distance' || d.kind === 'measure-area' || d.kind === 'route') return null

    const cat = getCategory(st.pending.category)
    const obj = draftToObject(d, {
      category: st.pending.category,
      color: st.pending.color ?? cat.color,
      icon: cat.icon,
      height: d.kind === 'building' ? st.pending.height : d.kind === 'fence' ? st.pending.height : undefined,
      buildingLevels: st.pending.buildingLevels,
      fenceType: st.pending.fenceType,
      fenceStyle: st.pending.fenceStyle,
    })
    if (!obj) {
      st.toast('warn', d.kind === 'line' ? 'Нужно минимум 2 точки' : 'Нужно минимум 3 точки')
      return null
    }
    obj.name = obj.name || `${cat.labelRu} ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
    if (obj.type === 'line') {
      obj.properties = {
        ...obj.properties,
        стиль: st.pending.lineStyle === 'dashed' ? 'dashed' : 'solid',
        ширина: obj.properties['ширина'] ?? 3,
      }
    }
    if (obj.type === 'fence') {
      obj.fenceOpacity = 0.92
      obj.category = 'fence'
    }
    st.addObjects([obj], `add:${obj.type}`)
    st.toast('ok', `${obj.type === 'line' ? 'Линия' : obj.type === 'fence' ? 'Ограждение' : obj.type === 'building' ? 'Здание' : 'Полигон'} создан${obj.type === 'line' ? 'а' : ''}`)
    st.setTool('select')
    st.select(obj.id)
    return obj
  }, [])

  const undoPoint = useCallback(() => {
    const st = useStore.getState()
    if (st.tool === 'measure-distance' || st.tool === 'measure-area') {
      st.setMeasurePoints(st.measure.points.slice(0, -1))
    } else if (st.tool === 'route') {
      st.setRoutePoints(st.route.points.slice(0, -1))
    } else {
      st.popDraftPoint()
    }
  }, [])

  return { draft, tool, pending, measure, finish, cancel, undoPoint }
}
