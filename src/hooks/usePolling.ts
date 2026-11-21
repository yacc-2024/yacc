import { useEffect, useRef } from 'react'

const IS_TEST = import.meta.env.MODE === 'test'

/**
 * 页面在前台时定时执行一个任务（切到后台自动暂停）。
 * 用来让「别人刚发的内容」自己出现，不用手动刷新。
 */
export function usePolling(
  task: () => void | Promise<void>,
  intervalMs: number,
  enabled = true,
): void {
  const saved = useRef(task)
  saved.current = task

  useEffect(() => {
    if (!enabled || IS_TEST) return

    let stopped = false
    let timer: number | null = null

    const run = async () => {
      if (stopped) return
      if (typeof document !== 'undefined' && document.hidden) return
      try {
        await saved.current()
      } catch {
        /* 轮询失败不打扰用户 */
      }
    }

    const schedule = () => {
      if (timer !== null) window.clearInterval(timer)
      timer = window.setInterval(() => void run(), intervalMs)
    }

    schedule()

    const onVisible = () => {
      if (document.hidden) return
      void run()
      schedule()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    return () => {
      stopped = true
      if (timer !== null) window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [intervalMs, enabled])
}
