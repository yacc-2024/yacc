import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp, mockContentFetch, resetAll, seedAdmin } from '../helpers'
import { clearSession } from '../../src/data/accounts'

beforeEach(() => {
  resetAll()
  mockContentFetch()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

describe('管理员：公告 增 / 改 / 删', () => {
  it('新增公告后公告页能看到', async () => {
    await seedAdmin()
    const user = userEvent.setup()
    const view = renderApp(['/admin/home'])

    await user.click(await screen.findByRole('button', { name: '新增公告' }))
    await user.type(await screen.findByLabelText('标题'), '期中后恢复拍摄')
    await user.type(screen.getByLabelText('正文'), '下周一开始，还是老地方。')
    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(await screen.findByText('公告已保存')).toBeInTheDocument()

    view.unmount()
    renderApp(['/news'])
    expect(await screen.findByText('期中后恢复拍摄')).toBeInTheDocument()
  })

  it('修改公告标题后生效', async () => {
    await seedAdmin()
    const user = userEvent.setup()
    renderApp(['/admin/home'])

    await user.click(await screen.findByText('第二季第三集已上线'))
    const title = await screen.findByLabelText('标题')
    await user.clear(title)
    await user.type(title, '第三集上线了')
    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(await screen.findByText('第三集上线了')).toBeInTheDocument()
    expect(screen.queryByText('第二季第三集已上线')).toBeNull()
  })

  it('删除公告需要确认，确认后消失且刷新不复活', async () => {
    await seedAdmin()
    const user = userEvent.setup()
    const view = renderApp(['/admin/home'])

    await user.click(await screen.findByText('换场地通知'))
    await user.click(await screen.findByRole('button', { name: '删除这条公告' }))
    expect(await screen.findByText('删除这条公告？')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '删除' }))

    await waitFor(() => expect(screen.queryByText('换场地通知')).toBeNull())

    view.unmount()
    renderApp(['/news'])
    await screen.findByText('公告')
    expect(screen.queryByText('换场地通知')).toBeNull()
  })
})

describe('管理员：活动 增 / 删', () => {
  it('新增活动后活动页出现，未登录只看到公开地点', async () => {
    await seedAdmin()
    const user = userEvent.setup()
    const view = renderApp(['/admin/home'])

    await user.click(await screen.findByRole('button', { name: '新增活动' }))
    await user.type(await screen.findByLabelText('标题'), '周末补拍')
    await user.type(screen.getByLabelText('公开地点'), '学校操场')
    await user.type(screen.getByLabelText('具体地点'), '教学楼后小操场')
    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(await screen.findByText('活动已保存')).toBeInTheDocument()
    view.unmount()

    await clearSession()
    renderApp(['/events'])
    expect(await screen.findByText('周末补拍')).toBeInTheDocument()
    expect((await screen.findAllByText(/学校操场/)).length).toBeGreaterThan(0)
    // 具体地点只在登录后出现
    expect(screen.queryByText(/教学楼后小操场/)).toBeNull()
  })

  it('删除活动后消失', async () => {
    await seedAdmin()
    const user = userEvent.setup()
    renderApp(['/admin/home'])

    await user.click(await screen.findByText('周六操场集合'))
    await user.click(await screen.findByRole('button', { name: '删除这个活动' }))
    await user.click(screen.getByRole('button', { name: '删除' }))

    await waitFor(() => expect(screen.queryByText('周六操场集合')).toBeNull())
  })
})

describe('管理员：最新推荐位', () => {
  it('移除推荐后主页少一张', async () => {
    await seedAdmin()
    const user = userEvent.setup()
    const view = renderApp(['/admin/home'])

    const removeButtons = await screen.findAllByRole('button', { name: '移除' })
    expect(removeButtons.length).toBe(2)
    await user.click(removeButtons[0])

    await waitFor(async () => {
      expect((await screen.findAllByRole('button', { name: '移除' })).length).toBe(1)
    })

    view.unmount()
    renderApp(['/'])
    const posters = await screen.findAllByRole('link', { name: /花絮|第.集|校园霸凌/ })
    expect(posters.length).toBeGreaterThan(0)
  })

  it('可以添加回推荐位', async () => {
    await seedAdmin()
    const user = userEvent.setup()
    renderApp(['/admin/home'])

    const removeButtons = await screen.findAllByRole('button', { name: '移除' })
    await user.click(removeButtons[0])
    await user.click(screen.getByRole('button', { name: '添加推荐' }))

    await user.click(await screen.findByText('反对校园霸凌'))
    await waitFor(async () => {
      expect((await screen.findAllByRole('button', { name: '移除' })).length).toBe(2)
    })
  })
})

describe('管理员：关于页', () => {
  it('改引言后关于页生效，并能在刷新后保留', async () => {
    await seedAdmin()
    const user = userEvent.setup()
    const view = renderApp(['/admin/about'])

    const lead = await screen.findByLabelText('为什么拍（引言）')
    await user.clear(lead)
    await user.type(lead, '我们想先把这件事讲清楚。')
    await user.click(screen.getByRole('button', { name: '保存引言与来源' }))
    expect(await screen.findByText('已保存')).toBeInTheDocument()

    view.unmount()
    renderApp(['/about'])
    expect(await screen.findByText('我们想先把这件事讲清楚。')).toBeInTheDocument()
  })
})

describe('持久化：关掉再开，改动还在', () => {
  it('改完主张 + 加公告，重新挂载后两者都在', async () => {
    await seedAdmin()
    const user = userEvent.setup()
    const view = renderApp(['/admin/home'])

    const claim = await screen.findByLabelText('主张（大字）')
    await user.clear(claim)
    await user.type(claim, '让沉默被看见')
    await user.click(screen.getByRole('button', { name: '保存头图与数据' }))
    await screen.findByText('已保存')

    await user.click(screen.getByRole('button', { name: '新增公告' }))
    await user.type(await screen.findByLabelText('标题'), '拍摄日志已更新')
    await user.click(screen.getByRole('button', { name: '保存' }))
    await screen.findByText('公告已保存')

    view.unmount()

    renderApp(['/'])
    expect(await screen.findByText('让沉默被看见')).toBeInTheDocument()

    const news = renderApp(['/news'])
    expect(await screen.findByText('拍摄日志已更新')).toBeInTheDocument()
    news.unmount()
  })
})

describe('批量删除', () => {
  it('更新日志可以一次删掉多个版本', async () => {
    await seedAdmin()
    const user = userEvent.setup()
    renderApp(['/admin/changelog'])

    // 先加一个版本，凑够两条
    await user.click(await screen.findByRole('button', { name: '新增版本' }))
    await user.type(await screen.findByLabelText('版本号'), '1.0.1')
    await user.type(screen.getByLabelText('改动内容'), '批量测试')
    await user.click(screen.getByRole('button', { name: '保存' }))
    await screen.findByText('更新日志已保存')

    // 进入选择模式
    await user.click(screen.getByRole('button', { name: '选择' }))
    await user.click(screen.getByRole('checkbox', { name: '选择 1.0.0' }))
    await user.click(screen.getByRole('checkbox', { name: '选择 1.0.1' }))
    expect(screen.getByText('已选 2 项')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '删除' }))
    await user.click(await screen.findByRole('button', { name: '批量删除' }))

    await waitFor(() => expect(screen.queryByText('1.0.1')).toBeNull())
    expect(screen.queryByText('1.0.0')).toBeNull()
  })
})
