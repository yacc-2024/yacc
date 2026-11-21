import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp, resetAll } from '../helpers'
import { ADMIN_CODE, mountApi } from '../helpers.online'

beforeEach(() => {
  resetAll()
  mountApi()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

/** 走真实 UI 激活管理员，确保登录态和缓存都写进去了 */
async function activateAdmin() {
  const user = userEvent.setup()
  const view = renderApp(['/login?mode=admin'])
  await user.type(await screen.findByLabelText('激活码'), ADMIN_CODE)
  await user.type(screen.getByLabelText('昵称'), '导演')
  await user.type(screen.getByLabelText('密码', { exact: true }), 'abc123')
  await user.type(screen.getByLabelText('确认密码', { exact: true }), 'abc123')
  await user.click(screen.getByRole('button', { name: '激活管理端' }))
  await screen.findByText('反对校园霸凌，人人有责')
  view.unmount()
}

describe('登录状态保持', () => {
  it('关掉再打开还是上次的账号，不用重新登录', async () => {
    await activateAdmin()
    const token = localStorage.getItem('yacc:token')
    expect(token).toBeTruthy()

    // 模拟关掉再打开：组件卸载后重新挂载，本机存储保留
    const view = renderApp(['/me'])
    expect(await screen.findByText('管理员')).toBeInTheDocument()
    expect(screen.getByText('管理中心')).toBeInTheDocument()
    view.unmount()

    renderApp(['/me'])
    expect(await screen.findByText('管理员')).toBeInTheDocument()
    expect(localStorage.getItem('yacc:token')).toBe(token)
  })

  it('网络抖动（后端 500）不会把人踢下线', async () => {
    await activateAdmin()
    const token = localStorage.getItem('yacc:token')
    const view = renderApp(['/me'])
    await screen.findByText('管理员')
    view.unmount()

    // 让 /auth/me 返回 500
    const realFetch = globalThis.fetch
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/api/auth/me')) {
        return new Response(JSON.stringify({ ok: false, error: '服务器开小差' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        })
      }
      return realFetch(input, init)
    })

    renderApp(['/me'])
    // 用缓存的身份继续显示已登录
    expect(await screen.findByText('管理员')).toBeInTheDocument()
    expect(localStorage.getItem('yacc:token')).toBe(token)
  })

  it('只有服务端明确说未登录（401）才清掉本地登录态', async () => {
    await activateAdmin()
    const view = renderApp(['/me'])
    await screen.findByText('管理员')
    view.unmount()

    const realFetch = globalThis.fetch
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/api/auth/me')) {
        return new Response(JSON.stringify({ ok: false, error: '未登录' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        })
      }
      return realFetch(input, init)
    })

    renderApp(['/me'])
    await waitFor(() => expect(localStorage.getItem('yacc:token')).toBeNull())
    // 登录卡片回来了
    expect(await screen.findByText('用邀请码加入剧组，收藏喜欢的作品。')).toBeInTheDocument()
  })

  it('退出登录会清掉本地登录态', async () => {
    await activateAdmin()
    const view = renderApp(['/me'])
    await screen.findByText('管理员')
    view.unmount()

    const user = userEvent.setup()
    renderApp(['/me/settings'])
    await user.click(await screen.findByText('退出登录'))
    await user.click(screen.getByRole('button', { name: '退出' }))

    await waitFor(() => expect(localStorage.getItem('yacc:token')).toBeNull())
    expect(localStorage.getItem('yacc:user')).toBeNull()
  })
})
