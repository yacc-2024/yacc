const KEY = 'yacc:glass-blur'
const ALPHA_KEY = 'yacc:glass-alpha'

export const DEFAULT_ALPHA = 100
export const MIN_ALPHA = 20
export const MAX_ALPHA = 100

export function getGlassAlpha(): number {
  try {
    const raw = localStorage.getItem(ALPHA_KEY)
    if (raw === null) return DEFAULT_ALPHA
    const v = Number(raw)
    if (!Number.isFinite(v)) return DEFAULT_ALPHA
    return Math.min(MAX_ALPHA, Math.max(MIN_ALPHA, v))
  } catch {
    return DEFAULT_ALPHA
  }
}

export function applyGlassAlpha(value: number): void {
  if (typeof document === 'undefined') return
  const v = Math.min(MAX_ALPHA, Math.max(MIN_ALPHA, Math.round(value)))
  document.documentElement.style.setProperty('--glass-alpha', String(v / 100))
}

export function setGlassAlpha(value: number): number {
  const v = Math.min(MAX_ALPHA, Math.max(MIN_ALPHA, Math.round(value)))
  try {
    localStorage.setItem(ALPHA_KEY, String(v))
  } catch {
    /* 忽略 */
  }
  applyGlassAlpha(v)
  return v
}
export const DEFAULT_BLUR = 22
export const MIN_BLUR = 0
export const MAX_BLUR = 40

export function getGlassBlur(): number {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === null) return DEFAULT_BLUR
    const v = Number(raw)
    if (!Number.isFinite(v)) return DEFAULT_BLUR
    return Math.min(MAX_BLUR, Math.max(MIN_BLUR, v))
  } catch {
    return DEFAULT_BLUR
  }
}

export function applyGlassBlur(value: number): void {
  if (typeof document === 'undefined') return
  const v = Math.min(MAX_BLUR, Math.max(MIN_BLUR, Math.round(value)))
  document.documentElement.style.setProperty('--glass-blur', `${v}px`)
  // 模糊接近 0 时退回实色，否则导航栏上的文字会互相重叠
  document.documentElement.dataset.glass = v <= 4 ? 'flat' : 'blur'
}

export function setGlassBlur(value: number): number {
  const v = Math.min(MAX_BLUR, Math.max(MIN_BLUR, Math.round(value)))
  try {
    localStorage.setItem(KEY, String(v))
  } catch {
    /* 隐私模式下写不进去，忽略 */
  }
  applyGlassBlur(v)
  return v
}

export function initGlassBlur(): void {
  applyGlassBlur(getGlassBlur())
  applyGlassAlpha(getGlassAlpha())
}
