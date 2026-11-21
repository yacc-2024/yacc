import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp, resetAll } from '../helpers'
import {
  ADMIN_CODE,
  makeAdmin,
  makeKey,
  mountApi,
  registerUser,
  setModeration,
} from '../helpers.online'

beforeEach(() => {
  resetAll()
  mountApi()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

describe('在线模式：接通后端', () => {
  it('用服务端口令创建管理员，进站后是管理员身份', async () => {
    const user = userEvent.setup()
    renderApp(['/login?mode=admin'])

    await user.type(await screen.findByLabelText('激活码'), ADMIN_CODE)
    await user.type(screen.getByLabelText('昵称'), '导演')
    await user.type(screen.getByLabelText('密码', { exact: true }), 'abc123')
    await user.type(screen.getByLabelText('确认密码', { exact: true }), 'abc123')
    await user.click(screen.getByRole('button', { name: '激活管理端' }))

    expect(await screen.findByText('反对校园霸凌，人人有责')).toBeInTheDocument()

    const view = renderApp(['/me'])
    expect(await screen.findByText('管理员')).toBeInTheDocument()
    expect(screen.getByText('管理中心')).toBeInTheDocument()
    view.unmount()
  })

  it('服务端口令错误不会被放行', async () => {
    const user = userEvent.setup()
    renderApp(['/login?mode=admin'])

    await user.type(await screen.findByLabelText('激活码'), 'WRONG')
    await user.type(screen.getByLabelText('昵称'), '假冒')
    await user.type(screen.getByLabelText('密码', { exact: true }), 'abc123')
    await user.type(screen.getByLabelText('确认密码', { exact: true }), 'abc123')
    await user.click(screen.getByRole('button', { name: '激活管理端' }))

    expect(await screen.findByText('激活口令不对')).toBeInTheDocument()
  })
})

describe('在线模式：发布内容', () => {
  it('改动后点「发布到线上」，重新打开别人也能看到', async () => {
    await makeAdmin()
    const user = userEvent.setup()
    const view = renderApp(['/admin/home'])

    const claim = await screen.findByLabelText('主张（大字）')
    await user.clear(claim)
    await user.type(claim, '线上发布的主张')
    await user.click(screen.getByRole('button', { name: '保存头图与数据' }))
    await screen.findByText('已保存')

    view.unmount()

    const data = renderApp(['/admin/data'])
    expect(await screen.findByText('在线模式已连接')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '发布到线上' }))
    await waitFor(() => expect(screen.getByText(/已发布第/)).toBeInTheDocument())
    data.unmount()

    // 换一台设备：本地什么都没了，服务端还在
    resetAll()
    const backend = await fetch('/api/content')
    const published = await backend.json()
    expect(published.home.claim).toBe('线上发布的主张')
  })
})

describe('在线模式：认证密钥与评论', () => {
  it('访客用密钥注册后可以评论，关审核时立刻可见', async () => {
    const admin = await makeAdmin()
    await setModeration(admin.token, 'off')
    const key = await makeKey(admin.token, 'visitor')
    await registerUser(key, '访客小明')

    renderApp(['/watch/ep-1-1'])
    await screen.findByRole('heading', { level: 1, name: '反对校园霸凌' })

    const box = await screen.findByLabelText('写评论')
    await userEvent.setup().type(box, '拍得很好，支持你们')
    await userEvent.setup().click(screen.getByRole('button', { name: '发布' }))

    expect(await screen.findByText('评论已发布')).toBeInTheDocument()
    expect(await screen.findByText('拍得很好，支持你们')).toBeInTheDocument()
    expect(screen.getByText('访客小明')).toBeInTheDocument()
  })

  it('开启审核时评论先不公开，管理员通过后才出现', async () => {
    const admin = await makeAdmin()
    await setModeration(admin.token, 'on')
    const key = await makeKey(admin.token, 'visitor')
    await registerUser(key, '访客小红')

    const viewer = renderApp(['/watch/ep-1-1'])
    await screen.findByRole('heading', { level: 1, name: '反对校园霸凌' })

    const box = await screen.findByLabelText('写评论')
    await userEvent.setup().type(box, '这条要审核')
    await userEvent.setup().click(screen.getByRole('button', { name: '发布' }))

    expect(await screen.findByText(/等负责人审核/)).toBeInTheDocument()
    expect(screen.queryByText('这条要审核')).toBeNull()
    viewer.unmount()

    // 管理员在后台通过
    const list = await fetch('/api/admin/comments?status=pending', {
      headers: { authorization: `Bearer ${admin.token}` },
    })
    const pending = await list.json()
    const id = pending.data.comments[0].id
    await fetch(`/api/admin/comments/${id}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${admin.token}`,
      },
      body: JSON.stringify({ status: 'published' }),
    })

    renderApp(['/watch/ep-1-1'])
    expect(await screen.findByText('这条要审核')).toBeInTheDocument()
  })

  it('没注册的游客看不到评论框', async () => {
    renderApp(['/watch/ep-1-1'])
    await screen.findByRole('heading', { level: 1, name: '反对校园霸凌' })
    expect(screen.queryByLabelText('写评论')).toBeNull()
    expect(screen.getByText('登录并通过学校认证后才能评论。')).toBeInTheDocument()
  })
})

describe('在线模式：点赞', () => {
  it('点一下加一，再点取消', async () => {
    const admin = await makeAdmin()
    const key = await makeKey(admin.token, 'visitor')
    await registerUser(key, '点赞的人')

    renderApp(['/watch/ep-1-1'])
    await screen.findByRole('heading', { level: 1, name: '反对校园霸凌' })

    const like = await screen.findByRole('button', { name: '点赞' })
    await userEvent.setup().click(like)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '取消点赞' })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: '取消点赞' })).toHaveTextContent('1')
  })
})
