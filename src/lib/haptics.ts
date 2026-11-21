/** 轻震动；不支持时静默忽略 */
export function vibrate(ms = 10): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(ms)
    }
  } catch {
    /* 忽略 */
  }
}
