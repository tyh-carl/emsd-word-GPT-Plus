import { onUnmounted, ref, watch } from 'vue'
import type { Ref } from 'vue'

export function useElapsedTimer(loading: Ref<boolean>) {
  const elapsedSeconds = ref(0)
  const isRunning = ref(false)
  let intervalId: ReturnType<typeof setInterval> | null = null

  function clearTimer() {
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  watch(loading, (val) => {
    if (val) {
      elapsedSeconds.value = 0
      isRunning.value = true
      intervalId = setInterval(() => {
        elapsedSeconds.value++
      }, 1000)
    } else {
      clearTimer()
      isRunning.value = false
    }
  })

  onUnmounted(() => {
    clearTimer()
  })

  return { elapsedSeconds, isRunning }
}
