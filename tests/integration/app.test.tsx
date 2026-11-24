import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp, mockContentFetch, resetAll } from '../helpers'
import seedJson from '../../public/content.json'

beforeEach(() => {
  resetAll()
  mockContentFetch()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

describe('主页', () => {
  it('渲染主张、数据、公告与页脚', async () => {
    renderApp(['/'])
    expect(await screen.findByText('反对校园霸凌，人人有责')).toBeInTheDocument()
    expect(screen.getByText('12.8%')).toBeInTheDocument()
    expect(screen.getByText('41%')).toBeInTheDocument()
    expect(screen.getByText('78.5%')).toBeInTheDocument()
    // 公告改为进入后弹出
    expect(await screen.findByText('第二季第三集已上线')).toBeInTheDocument()
    expect(screen.getByText(/北京师范大学天津静海实验学校/)).toBeInTheDocument()
  })

  it('四个 Tab 都在', async () => {
    renderApp(['/'])
    await screen.findByText('反对校园霸凌，人人有责')
    const nav = screen.getByRole('navigation', { name: '主导航' })
    expect(within(nav).getByText('主页')).toBeInTheDocument()
    expect(within(nav).getByText('成员')).toBeInTheDocument()
    expect(within(nav).getByText('作品')).toBeInTheDocument()
    expect(within(nav).getByText('我的')).toBeInTheDocument()
  })

  it('推荐位可点进播放页', async () => {
    const user = userEvent.setup()
    renderApp(['/'])
    const card = await screen.findByRole('link', { name: '第三集 第二季 · 第三集' })
    await user.click(card)
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: '第三集' })).toBeInTheDocument()
    })
  })
})

describe('关于页', () => {
  it('数据出处可展开，含可复制引用', async () => {
    const user = userEvent.setup()
    renderApp(['/about'])
    const source = await screen.findByText(/来源：/)
    await user.click(source)
    expect(screen.getByRole('button', { name: '复制引用' })).toBeInTheDocument()
  })

  it('分工链接到成员页并带上筛选', async () => {
    renderApp(['/about'])
    const link = await screen.findByRole('link', { name: /导演/ })
    expect(link).toHaveAttribute('href', '/members?role=%E5%AF%BC%E6%BC%94')
  })
})

describe('成员（未登录）', () => {
  it('显示登录引导，且页面上没有任何成员姓名', async () => {
    renderApp(['/members'])
    expect(await screen.findByText('成员名单仅剧组内部可见')).toBeInTheDocument()
    expect(screen.queryByText('张睿轩')).toBeNull()
    expect(screen.queryByText('待补充 01')).toBeNull()
  })
})

describe('作品', () => {
  it('第一季 1 集，切到第二季 3 集', async () => {
    const user = userEvent.setup()
    renderApp(['/works'])
    expect(await screen.findByText('反对校园霸凌')).toBeInTheDocument()
    // 第一季只有 1 集，第二季的「第二集」不该出现
    expect(screen.queryByText('第二集')).toBeNull()

    await user.click(screen.getByRole('button', { name: '第二季' }))

    expect(await screen.findByText('第一集')).toBeInTheDocument()
    expect(screen.getByText('第二集')).toBeInTheDocument()
    expect(screen.getByText('第三集')).toBeInTheDocument()
    // 标题本身已经是「第X集」时，不再重复一个序号前缀
    expect(screen.getAllByText('第一集')).toHaveLength(1)
  })

  it('花絮 Tab 还没内容时显示空状态', async () => {
    const user = userEvent.setup()
    renderApp(['/works'])
    await screen.findByText('反对校园霸凌')
    await user.click(screen.getByRole('tab', { name: '花絮' }))
    expect(await screen.findByText('花絮还在剪')).toBeInTheDocument()
  })

  it('剧集显示真实时长与封面', async () => {
    renderApp(['/works'])
    // 第一季那一集是 3 分 21 秒
    expect(await screen.findByText(/03:21/)).toBeInTheDocument()
    const cover = document.querySelector('img[alt="反对校园霸凌"]')
    expect(cover?.getAttribute('src')).toBe('/covers/s1e1.jpg')
  })

  it('空季显示「这一季还在剪」', async () => {
    const seed = JSON.parse(JSON.stringify(seedJson))
    seed.episodes = seed.episodes.filter((e: { seasonId: string }) => e.seasonId !== 's-1')
    seed.home.featured = []
    resetAll()
    mockContentFetch(seed)
    renderApp(['/works'])
    expect(await screen.findByText('这一季还在剪')).toBeInTheDocument()
  })
})

describe('播放页', () => {
  it('真实链接没填时显示「即将上线」，不放别人的视频', async () => {
    renderApp(['/watch/ep-2-3'])
    expect(
      await screen.findByRole('heading', { level: 1, name: '第三集' }),
    ).toBeInTheDocument()
    expect(screen.getByText('视频即将上线')).toBeInTheDocument()
    expect(screen.queryByTitle('第三集')).toBeNull()
    expect(screen.getByText('已是最新一集')).toBeInTheDocument()
  })

  it('换成真实 BV 号后渲染嵌入播放器', async () => {
    const seed = JSON.parse(JSON.stringify(seedJson))
    seed.episodes = seed.episodes.map((e: any) =>
      e.id === 'ep-2-3' ? { ...e, videoId: 'BV1GJ411x7h7' } : e,
    )
    resetAll()
    mockContentFetch(seed)
    renderApp(['/watch/ep-2-3'])

    expect(await screen.findByRole('heading', { level: 1, name: '第三集' })).toBeInTheDocument()
    const frame = await screen.findByTitle('第三集')
    expect(frame.tagName).toBe('IFRAME')
    expect(frame.getAttribute('src')).toContain('BV1GJ411x7h7')
    expect(screen.queryByText('视频即将上线')).toBeNull()
  })

  it('未登录点收藏会提示登录', async () => {
    const user = userEvent.setup()
    renderApp(['/watch/ep-2-3'])
    await screen.findByRole('heading', { level: 1, name: '第三集' })
    await user.click(screen.getByRole('button', { name: '收藏' }))
    expect(await screen.findByText('登录后可收藏')).toBeInTheDocument()
  })

  it('找不到的 id 显示空状态', async () => {
    renderApp(['/watch/nope'])
    expect(await screen.findByText('找不到这条内容')).toBeInTheDocument()
  })
})
