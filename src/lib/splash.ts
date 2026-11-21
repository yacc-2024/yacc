/**
 * 关掉开屏画面：等首屏渲染完成再淡出，避免看到半成品。
 * 至少展示 500ms，太快反而像闪了一下。
 */
const START = Date.now()
const MIN_SHOW = 500

export function hideSplash(): void {
  if (typeof document === 'undefined') return
  const el = document.getElementById('yacc-splash')
  if (!el) return

  const wait = Math.max(0, MIN_SHOW - (Date.now() - START))
  window.setTimeout(() => {
    el.classList.add('is-hiding')
    window.setTimeout(() => el.remove(), 460)
  }, wait)
}
