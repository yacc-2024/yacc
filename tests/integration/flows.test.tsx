import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp, mockContentFetch, resetAll, seedAdmin, seedMember } from '../helpers'
import { clearSession } from '../../src/data/accounts'
import { listAccounts } from '../../src/data/accounts'

beforeEach(() => {
  resetAll()
  mockContentFetch()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  // jsdom 没有这两个，导出功能要用
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:mock'),
  })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
})

describe('管理员激活（不是谁都能当管理员）', () => {
  it('普通访客打开登录页，只有登录和注册', async () => {
    const user = userEvent.setup()
    renderApp(['/login'])
    await screen.findByText('用你的账号登录。')
    expect(screen.getByRole('tab', { name: '注册' })).toBeInTheDocument()
    // 不允许自动进入"创建管理员"
    expect(screen.queryByText(/这台设备还没有账号/)).toBeNull()
    expect(screen.queryByLabelText('激活码')).toBeNull()
    // 即使乱点也创建不出管理员
    await user.click(screen.getByRole('button', { name: '登录' }))
    expect(await listAccounts()).toHaveLength(0)
  })

  it('激活码错误不能创建管理员', async () => {
    const user = userEvent.setup()
    renderApp(['/login?mode=admin'])
    await user.type(await screen.findByLabelText('激活码'), 'WRONG-CODE')
    await user.type(screen.getByLabelText('昵称'), '导演')
    await user.type(screen.getByLabelText('密码'), 'abc123')
    await user.type(screen.getByLabelText('确认密码'), 'abc123')
    await user.click(screen.getByRole('button', { name: '激活管理端' }))

    expect(await screen.findByText('激活码不对')).toBeInTheDocument()
    expect(await listAccounts()).toHaveLength(0)
  })

  it('激活码正确才创建出管理员', async () => {
    const user = userEvent.setup()
    renderApp(['/login?mode=admin'])
    await user.type(await screen.findByLabelText('激活码'), 'YACC-ADMIN-2026')
    await user.type(screen.getByLabelText('昵称'), '导演')
    await user.type(screen.getByLabelText('密码'), 'abc123')
    await user.type(screen.getByLabelText('确认密码'), 'abc123')
    await user.click(screen.getByRole('button', { name: '激活管理端' }))

    expect(await screen.findByText('反对校园霸凌，人人有责')).toBeInTheDocument()
    const accounts = await listAccounts()
    expect(accounts).toHaveLength(1)
    expect(accounts[0].role).toBe('admin')
  })

  it('这台设备已有管理员时不能再激活第二个', async () => {
    await seedAdmin('原管理员')
    await clearSession()
    const user = userEvent.setup()
    renderApp(['/login?mode=admin'])
    await user.type(await screen.findByLabelText('激活码'), 'YACC-ADMIN-2026')
    await user.type(screen.getByLabelText('昵称'), '新管理员')
    await user.type(screen.getByLabelText('密码'), 'abc123')
    await user.type(screen.getByLabelText('确认密码'), 'abc123')
    await user.click(screen.getByRole('button', { name: '激活管理端' }))

    expect(await screen.findByText(/已经有管理员/)).toBeInTheDocument()
    expect(await listAccounts()).toHaveLength(1)
  })
})

describe('注册与登录', () => {
  it('用邀请码注册后能看到成员名单', async () => {
    await seedAdmin() // 先有账号，避免进入初始化模式
    await clearSession()
    const user = userEvent.setup()
    renderApp(['/login?mode=register'])

    await user.type(await screen.findByLabelText('认证密钥'), 'YACC2026')
    await user.type(screen.getByLabelText('昵称'), '新成员')
    await user.type(screen.getByLabelText('密码'), 'abc123')
    await user.type(screen.getByLabelText('确认密码'), 'abc123')
    await user.click(screen.getByRole('button', { name: '加入剧组' }))

    await waitFor(() => expect(screen.getByText('反对校园霸凌，人人有责')).toBeInTheDocument())
  })

  it('邀请码错误会被拒', async () => {
    await seedAdmin()
    await clearSession()
    const user = userEvent.setup()
    renderApp(['/login?mode=register'])

    await user.type(await screen.findByLabelText('认证密钥'), 'WRONG')
    await user.type(screen.getByLabelText('昵称'), '新成员')
    await user.type(screen.getByLabelText('密码'), 'abc123')
    await user.type(screen.getByLabelText('确认密码'), 'abc123')
    await user.click(screen.getByRole('button', { name: '加入剧组' }))

    expect(await screen.findByText('邀请码不对')).toBeInTheDocument()
  })

  it('两次密码不一致会提示', async () => {
    await seedAdmin()
    await clearSession()
    const user = userEvent.setup()
    renderApp(['/login?mode=register'])

    await user.type(await screen.findByLabelText('认证密钥'), 'YACC2026')
    await user.type(screen.getByLabelText('昵称'), '新成员')
    await user.type(screen.getByLabelText('密码'), 'abc123')
    await user.type(screen.getByLabelText('确认密码'), 'abc999')
    await user.click(screen.getByRole('button', { name: '加入剧组' }))

    expect(await screen.findByText('两次密码不一样')).toBeInTheDocument()
  })
})

describe('登录后自动完成收藏', () => {
  it('未登录收藏 -> 登录 -> 回到播放页并已收藏', async () => {
    await seedMember('观影人')
    await clearSession()
    const user = userEvent.setup()
    renderApp(['/watch/ep-2-3'])

    await screen.findByRole('heading', { level: 1, name: '第三集' })
    await user.click(screen.getByRole('button', { name: '收藏' }))
    await user.click(await screen.findByRole('button', { name: '去登录' }))

    await user.type(await screen.findByLabelText('昵称'), '观影人')
    await user.type(screen.getByLabelText('密码'), 'abc123')
    await user.click(screen.getByRole('button', { name: '登录' }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: '第三集' })).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '取消收藏' })).toBeInTheDocument()
    })
  })
})

describe('权限', () => {
  it('普通成员访问 /admin 被送回主页', async () => {
    await seedMember('普通成员')
    renderApp(['/admin'])
    expect(await screen.findByText('反对校园霸凌，人人有责')).toBeInTheDocument()
  })

  it('管理员能在「我的」看到管理中心入口', async () => {
    await seedAdmin()
    renderApp(['/me'])
    expect(await screen.findByText('管理中心')).toBeInTheDocument()
  })

  it('普通成员看不到管理中心', async () => {
    await seedMember()
    renderApp(['/me'])
    await screen.findByText('我的收藏')
    expect(screen.queryByText('管理中心')).toBeNull()
  })
})

describe('管理：改主页', () => {
  it('修改主张后保存，刷新（重新挂载）仍然生效', async () => {
    await seedAdmin()
    const user = userEvent.setup()
    const first = renderApp(['/admin/home'])

    const claim = await screen.findByLabelText('主张（大字）')
    await user.clear(claim)
    await user.type(claim, '新的主张')
    await user.click(screen.getByRole('button', { name: '保存头图与数据' }))

    expect(await screen.findByText('已保存')).toBeInTheDocument()
    expect(screen.getByText(/有未发布的修改/)).toBeInTheDocument()

    first.unmount()

    renderApp(['/'])
    expect(await screen.findByText('新的主张')).toBeInTheDocument()
  })

  it('保存后内容包导出被调用', async () => {
    await seedAdmin()
    const user = userEvent.setup()
    renderApp(['/admin/data'])
    await user.click(await screen.findByText('导出内容包'))
    expect((URL.createObjectURL as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBeGreaterThan(0)
  })
})

describe('管理：成员增删', () => {
  it('新增成员后成员页能看到', async () => {
    await seedAdmin()
    const user = userEvent.setup()
    const view = renderApp(['/admin/members'])

    await user.click(await screen.findByRole('button', { name: '新增成员' }))
    await user.type(await screen.findByLabelText('名字'), '新同学')
    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(await screen.findByText('新同学')).toBeInTheDocument()

    view.unmount()
    renderApp(['/members'])
    expect(await screen.findByText('新同学')).toBeInTheDocument()
  })

  it('删除成员需要确认，确认后消失', async () => {
    await seedAdmin()
    const user = userEvent.setup()
    renderApp(['/admin/members'])

    await user.click(await screen.findByText('张睿轩'))
    await user.click(await screen.findByRole('button', { name: '删除这个成员' }))
    expect(await screen.findByText('删除这个成员？')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '删除' }))

    await waitFor(() => {
      expect(screen.queryByText('张睿轩')).toBeNull()
    })
  })
})

describe('管理：作品', () => {
  it('添加剧集时粘贴链接能识别 BV 号', async () => {
    await seedAdmin()
    const user = userEvent.setup()
    renderApp(['/admin/works'])

    await user.click(await screen.findByText('＋ 添加剧集'))
    const link = await screen.findByLabelText('B 站 / YouTube 链接')
    await user.type(link, 'https://www.bilibili.com/video/BV1xx411c7mD')

    expect(await screen.findByText(/已识别 B 站视频 BV1xx411c7mD/)).toBeInTheDocument()
    expect(screen.getByLabelText('视频 ID')).toHaveValue('BV1xx411c7mD')
  })

  it('粘贴非法链接给出提示且不填 ID', async () => {
    await seedAdmin()
    const user = userEvent.setup()
    renderApp(['/admin/works'])

    await user.click(await screen.findByText('＋ 添加剧集'))
    const link = await screen.findByLabelText('B 站 / YouTube 链接')
    await user.type(link, 'https://example.com/abc')

    expect(await screen.findByText(/没识别出视频 ID/)).toBeInTheDocument()
    expect(screen.getByLabelText('视频 ID')).toHaveValue('')
  })
})

describe('数据：导入', () => {
  it('损坏的文件不会破坏现有数据', async () => {
    await seedAdmin()
    const user = userEvent.setup()
    renderApp(['/admin/data'])

    const input = await screen.findByLabelText('选择配置文件')
    const file = new File(['{ broken json'], 'bad.json', { type: 'application/json' })
    await user.upload(input, file)

    expect(await screen.findByText('这个文件不能导入')).toBeInTheDocument()
    expect(screen.getByText(/现有数据没有改动/)).toBeInTheDocument()
  })

  it('内容包会被提示「只恢复内容」', async () => {
    await seedAdmin()
    const user = userEvent.setup()
    renderApp(['/admin/data'])

    const input = await screen.findByLabelText('选择配置文件')
    const pack = {
      kind: 'content',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      content: {
        ...(await import('../../public/content.json')).default,
      },
    }
    const file = new File([JSON.stringify(pack)], 'content.json', {
      type: 'application/json',
    })
    await user.upload(input, file)

    expect(await screen.findByText('确认导入')).toBeInTheDocument()
    expect(screen.getByText(/账号与收藏不会恢复/)).toBeInTheDocument()
  })
})
