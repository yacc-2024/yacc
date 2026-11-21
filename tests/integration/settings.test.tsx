import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderApp, mockContentFetch, resetAll, seedAdmin } from '../helpers'

beforeEach(() => {
  resetAll()
  mockContentFetch()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  document.documentElement.removeAttribute('style')
})

describe('外观设置', () => {
  it('拖模糊度滑杆会立刻改全局 CSS 变量', async () => {
    await seedAdmin()
    renderApp(['/me/settings/appearance'])

    const slider = await screen.findByLabelText('毛玻璃模糊度')
    fireEvent.change(slider, { target: { value: '36' } })

    expect(document.documentElement.style.getPropertyValue('--glass-blur')).toBe('36px')
    expect(localStorage.getItem('yacc:glass-blur')).toBe('36')
    // 界面上同步显示数值
    expect(screen.getByText('36px')).toBeInTheDocument()
  })

  it('调到 0 也能生效（等于关掉模糊）', async () => {
    await seedAdmin()
    renderApp(['/me/settings/appearance'])
    const slider = await screen.findByLabelText('毛玻璃模糊度')
    fireEvent.change(slider, { target: { value: '0' } })
    expect(document.documentElement.style.getPropertyValue('--glass-blur')).toBe('0px')
  })
})
