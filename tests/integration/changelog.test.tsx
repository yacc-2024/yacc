import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp, mockContentFetch, resetAll, seedAdmin } from '../helpers'

beforeEach(() => {
  resetAll()
  mockContentFetch()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

describe('更新日志管理', () => {
  it('新增一个版本，版本页能看到', async () => {
    await seedAdmin()
    const user = userEvent.setup()
    const view = renderApp(['/admin/changelog'])

    await user.click(await screen.findByRole('button', { name: '新增版本' }))
    await user.type(await screen.findByLabelText('版本号'), '1.0.2')
    await user.type(
      screen.getByLabelText('改动内容'),
      '主页公告更醒目{enter}账号支持头像',
    )
    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(await screen.findByText('更新日志已保存')).toBeInTheDocument()
    expect(await screen.findByText('1.0.2')).toBeInTheDocument()

    view.unmount()
    const version = renderApp(['/me/version'])
    expect(await screen.findByText('1.0.2')).toBeInTheDocument()
    expect(screen.getByText(/主页公告更醒目/)).toBeInTheDocument()
    version.unmount()
  })

  it('删除一个版本后消失', async () => {
    await seedAdmin()
    const user = userEvent.setup()
    renderApp(['/admin/changelog'])

    await user.click(await screen.findByText('1.0.0'))
    await user.click(await screen.findByRole('button', { name: '删除这个版本' }))
    await user.click(await screen.findByRole('button', { name: '删除' }))

    await waitFor(() => expect(screen.queryByText('1.0.0')).toBeNull())
  })

  it('版本号重复会被拦下', async () => {
    await seedAdmin()
    const user = userEvent.setup()
    renderApp(['/admin/changelog'])

    await user.click(await screen.findByRole('button', { name: '新增版本' }))
    await user.type(await screen.findByLabelText('版本号'), '1.0.0')
    await user.type(screen.getByLabelText('改动内容'), '重复的')
    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(await screen.findByText('这个版本号已经有了')).toBeInTheDocument()
  })
})

describe('外观：深浅色与字号', () => {
  it('切成深色会写到 html 上，刷新后仍生效', async () => {
    await seedAdmin()
    const user = userEvent.setup()
    renderApp(['/me/settings/appearance'])

    await user.click(await screen.findByRole('tab', { name: '深色' }))
    expect(document.documentElement.dataset.theme).toBe('dark')

    renderApp(['/me/settings/appearance'])
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('字号切成大会改根字号', async () => {
    await seedAdmin()
    const user = userEvent.setup()
    renderApp(['/me/settings/appearance'])

    await user.click(await screen.findByRole('tab', { name: '更大' }))
    expect(document.documentElement.style.fontSize).toBe('125%')
  })
})
