import { describe, it, expect } from 'vitest'
import { validateContent, validateBackup, checkFileBudget } from '../../src/data/validate'
import { validContent, clone } from '../fixtures'
import type { Content } from '../../src/data/schema'

function mutate(fn: (c: any) => void): unknown {
  const c = validContent() as any
  fn(c)
  return c
}

describe('validateContent', () => {
  it('种子内容合法', () => {
    const result = validateContent(validContent())
    expect(result.ok).toBe(true)
  })

  it('缺 site.name 时报出字段路径', () => {
    const result = validateContent(mutate((c) => delete c.site.name))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('site.name')
    }
  })

  it('集指向不存在的季 -> 悬空引用', () => {
    const result = validateContent(mutate((c) => (c.episodes[0].seasonId = 's-999')))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('s-999')
      expect(result.errors.join(' ')).toContain('episodes[0].seasonId')
    }
  })

  it('成员 ID 重复', () => {
    const result = validateContent(mutate((c) => (c.members[1].id = c.members[0].id)))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join(' ')).toContain('ID 重复')
  })

  it('BV 号长度不对', () => {
    const result = validateContent(mutate((c) => (c.episodes[0].videoId = 'BV123')))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join(' ')).toContain('videoId')
  })

  it('活动时间缺时区', () => {
    const result = validateContent(
      mutate((c) => (c.events[0].startAt = '2026-11-22T14:00:00')),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join(' ')).toContain('startAt')
  })

  it('活动结束早于开始', () => {
    const result = validateContent(
      mutate((c) => {
        c.events[0].startAt = '2026-11-22T14:00:00+08:00'
        c.events[0].endAt = '2026-11-22T13:00:00+08:00'
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join(' ')).toContain('结束时间不能早于开始时间')
  })

  it('推荐位指向不存在的集', () => {
    const result = validateContent(
      mutate((c) => (c.home.featured[0] = { type: 'episode', id: 'ep-404' })),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join(' ')).toContain('ep-404')
  })

  it('推荐位指向不存在的花絮', () => {
    const result = validateContent(
      mutate((c) => (c.home.featured[0] = { type: 'extra', id: 'ex-404' })),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join(' ')).toContain('ex-404')
  })

  it('schemaVersion 高于当前版本被拒', () => {
    const result = validateContent(mutate((c) => (c.schemaVersion = 99)))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join(' ')).toContain('99')
  })

  it('日期格式不对', () => {
    const result = validateContent(mutate((c) => (c.episodes[0].publishedAt = '2026/09/20')))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join(' ')).toContain('publishedAt')
  })

  it('邀请码格式不对', () => {
    const result = validateContent(mutate((c) => (c.site.inviteCode = 'ab')))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join(' ')).toContain('inviteCode')
  })

  it('花絮关联到不存在的集', () => {
    const result = validateContent(
      mutate((c) => {
        // 种子数据里现在没有花絮，先造一条再把它指向不存在的集
        c.extras = [
          {
            id: 'ex-test',
            title: '花絮',
            platform: 'bilibili',
            videoId: 'BV1xx411c7mD',
            relatedEpisodeId: 'ep-404',
            cover: null,
            durationSec: 30,
            publishedAt: '2026-11-01',
          },
        ]
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join(' ')).toContain('ep-404')
  })

  it('根不是对象', () => {
    expect(validateContent(null).ok).toBe(false)
    expect(validateContent('x').ok).toBe(false)
  })

  it('空集合也算合法（新站点）', () => {
    const empty = clone(validContent()) as Content
    empty.members = []
    empty.episodes = []
    empty.extras = []
    empty.announcements = []
    empty.events = []
    empty.home.featured = []
    expect(validateContent(empty).ok).toBe(true)
  })
})

describe('validateBackup', () => {
  it('内容包不能被当作备份导入', () => {
    const pack = {
      kind: 'content',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      content: validContent(),
    }
    const result = validateBackup(pack)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join(' ')).toContain('backup')
  })

  it('合法备份通过', () => {
    const result = validateBackup({
      kind: 'backup',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      content: validContent(),
      accounts: [
        {
          id: 'u-1',
          name: '导演',
          passwordHash: 'abc',
          salt: 'def',
          role: 'admin',
          memberId: null,
          createdAt: new Date().toISOString(),
        },
      ],
      favorites: [],
      history: [],
    })
    expect(result.ok).toBe(true)
  })
})

describe('checkFileBudget', () => {
  it('超过 5MB 被拒', () => {
    expect(checkFileBudget(6 * 1024 * 1024)).toContain('5MB')
  })
  it('正常大小通过', () => {
    expect(checkFileBudget(1024)).toBeNull()
  })
})
