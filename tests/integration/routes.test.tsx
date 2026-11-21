import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderApp, mockContentFetch, resetAll, seedAdmin } from '../helpers'

beforeEach(() => {
  resetAll()
  mockContentFetch()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

const PUBLIC_ROUTES: Array<[string, RegExp]> = [
  ['/', /反对校园霸凌，人人有责/],
  ['/about', /为什么拍/],
  ['/news', /公告/],
  ['/events', /活动/],
  ['/works', /第一季/],
  ['/watch/ep-1-1', /反对校园霸凌/],
  ['/watch/ex-1', /花絮：开机第一天/],
  ['/me', /yacc/],
  ['/me/version', /版本与更新日志/],
  ['/login', /yacc/],
]

describe('公开路由全部能渲染', () => {
  it.each(PUBLIC_ROUTES)('%s', async (path, expected) => {
    const { container } = renderApp([path])
    const found = await screen.findAllByText(expected)
    expect(found.length).toBeGreaterThan(0)
    expect(container.textContent?.length ?? 0).toBeGreaterThan(24)
  })
})

const AUTH_ROUTES: Array<[string, RegExp]> = [
  ['/me/favorites', /我的收藏/],
  ['/me/history', /观看历史/],
  ['/me/settings', /账号设置/],
  ['/admin', /管理中心/],
  ['/admin/home', /头图/],
  ['/admin/about', /为什么拍/],
  ['/admin/members', /成员管理/],
  ['/admin/works', /作品管理/],
  ['/admin/data', /数据管理/],
]

describe('登录后可访问的路由全部能渲染', () => {
  it.each(AUTH_ROUTES)('%s', async (path, expected) => {
    await seedAdmin()
    renderApp([path])
    const found = await screen.findAllByText(expected)
    expect(found.length).toBeGreaterThan(0)
  })
})

describe('未知路由', () => {
  it('回到主页而不是白屏', async () => {
    renderApp(['/this/does/not/exist'])
    expect(await screen.findByText('反对校园霸凌，人人有责')).toBeInTheDocument()
  })
})

describe('成员详情', () => {
  it('能打开并显示分工与参与作品', async () => {
    await seedAdmin()
    renderApp(['/members/m-01'])
    const headings = await screen.findAllByRole('heading', { name: '张睿轩' })
    expect(headings.length).toBeGreaterThan(0)
    expect(screen.getByText(/导演/)).toBeInTheDocument()
    expect(screen.getByText('参与作品')).toBeInTheDocument()
  })

  it('不存在的成员显示空状态', async () => {
    await seedAdmin()
    renderApp(['/members/m-404'])
    expect(await screen.findByText('找不到这个成员')).toBeInTheDocument()
  })
})
