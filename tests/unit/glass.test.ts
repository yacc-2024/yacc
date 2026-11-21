import { describe, it, expect, beforeEach } from 'vitest'
import {
  DEFAULT_BLUR,
  MAX_BLUR,
  applyGlassBlur,
  getGlassBlur,
  setGlassBlur,
} from '../../src/lib/glass'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('style')
})

describe('毛玻璃模糊度设置', () => {
  it('没设置过时用默认值', () => {
    expect(getGlassBlur()).toBe(DEFAULT_BLUR)
  })

  it('设置后写进本地存储并立刻改 CSS 变量', () => {
    const v = setGlassBlur(34)
    expect(v).toBe(34)
    expect(localStorage.getItem('yacc:glass-blur')).toBe('34')
    expect(document.documentElement.style.getPropertyValue('--glass-blur')).toBe('34px')
  })

  it('超出范围会被夹住', () => {
    expect(setGlassBlur(999)).toBe(MAX_BLUR)
    expect(setGlassBlur(-5)).toBe(0)
  })

  it('重新读取时恢复上次的值', () => {
    setGlassBlur(8)
    expect(getGlassBlur()).toBe(8)
  })

  it('存了脏数据时回退默认值', () => {
    localStorage.setItem('yacc:glass-blur', 'abc')
    expect(getGlassBlur()).toBe(DEFAULT_BLUR)
  })

  it('applyGlassBlur 只改变量不写存储', () => {
    applyGlassBlur(12)
    expect(document.documentElement.style.getPropertyValue('--glass-blur')).toBe('12px')
    expect(localStorage.getItem('yacc:glass-blur')).toBeNull()
  })
})
