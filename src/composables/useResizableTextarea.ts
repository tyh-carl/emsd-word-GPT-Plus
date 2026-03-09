import { onUnmounted, ref } from 'vue'

interface UseResizableTextareaOptions {
  minHeight?: number
  maxHeight?: number
  defaultHeight?: number
}

export function useResizableTextarea(options: UseResizableTextareaOptions = {}) {
  const { minHeight = 60, maxHeight = 400, defaultHeight = 120 } = options

  const containerHeight = ref(defaultHeight)
  const isDragging = ref(false)

  let startY = 0
  let startHeight = 0

  function onPointerMove(e: PointerEvent) {
    if (!isDragging.value) return
    const delta = startY - e.clientY // upward drag = positive delta = expand
    const newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + delta))
    containerHeight.value = newHeight
  }

  function onPointerUp() {
    if (!isDragging.value) return
    isDragging.value = false
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
  }

  function onDragStart(e: PointerEvent) {
    e.preventDefault()
    isDragging.value = true
    startY = e.clientY
    startHeight = containerHeight.value
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  onUnmounted(() => {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
  })

  return {
    containerHeight,
    isDragging,
    onDragStart,
  }
}
