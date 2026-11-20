import { useEffect, useState } from 'react'
import { importFile } from '@/features/actions'

/** Drag & drop GeoJSON / GPX / images straight onto the window. */
export function useFileDrop() {
  const [over, setOver] = useState(false)

  useEffect(() => {
    let depth = 0
    const onDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return
      depth++
      setOver(true)
    }
    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
    const onDragLeave = () => {
      depth = Math.max(0, depth - 1)
      if (depth === 0) setOver(false)
    }
    const onDrop = async (e: DragEvent) => {
      e.preventDefault()
      depth = 0
      setOver(false)
      const files = Array.from(e.dataTransfer?.files ?? [])
      for (const f of files) await importFile(f)
    }
    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  return { over }
}
