const THEME_KEY = 'yacc:theme'
const MOTION_KEY = 'yacc:motion'
const FONT_KEY = 'yacc:font'

export type ThemeMode = 'system' | 'light' | 'dark'
export type MotionMode = 'smooth' | 'balanced' | 'performance'
export type FontScale = 100 | 112 | 125

function read(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* 隐私模式忽略 */
  }
}

/* ---------------- 主题 ---------------- */

export function getThemeMode(): ThemeMode {
  const raw = read(THEME_KEY, 'system')
  return raw === 'light' || raw === 'dark' ? raw : 'system'
}

export function applyThemeMode(mode: ThemeMode): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (mode === 'system') root.removeAttribute('data-theme')
  else root.dataset.theme = mode
}

export function setThemeMode(mode: ThemeMode): void {
  write(THEME_KEY, mode)
  applyThemeMode(mode)
}

/* ---------------- 动效 ---------------- */

export function getMotionMode(): MotionMode {
  const raw = read(MOTION_KEY, 'balanced')
  // 兼容旧值：full → balanced，reduced → performance
  if (raw === 'full') return 'balanced'
  if (raw === 'reduced') return 'performance'
  return raw === 'smooth' || raw === 'performance' ? raw : 'balanced'
}

export function applyMotionMode(mode: MotionMode): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.motion = mode
}

export function setMotionMode(mode: MotionMode): void {
  write(MOTION_KEY, mode)
  applyMotionMode(mode)
}

/* ---------------- 字号 ---------------- */

export function getFontScale(): FontScale {
  const value = Number(read(FONT_KEY, '100'))
  return value === 112 || value === 125 ? value : 100
}

export function applyFontScale(scale: FontScale): void {
  if (typeof document === 'undefined') return
  document.documentElement.style.fontSize = `${scale}%`
}

export function setFontScale(scale: FontScale): void {
  write(FONT_KEY, String(scale))
  applyFontScale(scale)
}

/* ---------------- 启动时应用 ---------------- */

export function initAppearance(): void {
  applyThemeMode(getThemeMode())
  applyMotionMode(getMotionMode())
  applyFontScale(getFontScale())
}
