const KEY = 'yacc:accent'

export interface AccentOption {
  value: string
  label: string
  color: string
}

/** 可选主题色 */
export const ACCENTS: AccentOption[] = [
  { value: 'blue', label: '天蓝', color: '#4DBDF5' },
  { value: 'ink', label: '墨黑', color: '#2B2B2F' },
  { value: 'green', label: '松绿', color: '#2FA97C' },
  { value: 'purple', label: '紫罗兰', color: '#8A5CFF' },
  { value: 'amber', label: '琥珀', color: '#E0A93A' },
  { value: 'rose', label: '绯红', color: '#F0506E' },
]

export function getAccent(): string {
  try {
    return localStorage.getItem(KEY) ?? 'blue'
  } catch {
    return 'blue'
  }
}

export function applyAccent(value: string): void {
  if (typeof document === 'undefined') return
  const option = ACCENTS.find((a) => a.value === value) ?? ACCENTS[0]
  const root = document.documentElement
  root.style.setProperty('--accent', option.color)
  root.style.setProperty('--accent-weak', `${option.color}26`)
  root.dataset.accent = option.value
}

export function setAccent(value: string): void {
  try {
    localStorage.setItem(KEY, value)
  } catch {
    /* 忽略 */
  }
  applyAccent(value)
}

export function initAccent(): void {
  applyAccent(getAccent())
}
