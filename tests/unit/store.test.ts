import { describe, it, expect, beforeEach } from 'vitest'
import { resolveContent } from '../../src/data/store'
import { makeDraft } from '../../src/data/draft'
import { validContent, clone } from '../fixtures'
import { __resetStorage } from '../../src/data/storage'
import { toggleInList, isFav } from '../../src/data/favorites'
import { pushHistory, HISTORY_LIMIT } from '../../src/data/history'
import { migrate, MigrationError } from '../../src/data/migrate'

beforeEach(() => __resetStorage())

describe('resolveContent', () => {
  it('没有草稿时用线上', () => {
    const remote = validContent()
    const r = resolveContent(remote, null)
    expect(r.source).toBe('remote')
    expect(r.conflict).toBe(false)
  })

  it('草稿基线与线上一致时用草稿', () => {
    const remote = validContent()
    const draftContent = clone(remote)
    draftContent.home.claim = '改过的'
    const draft = makeDraft(draftContent, remote.updatedAt)
    const r = resolveContent(remote, draft)
    expect(r.source).toBe('draft')
    expect(r.content.home.claim).toBe('改过的')
    expect(r.conflict).toBe(false)
  })

  it('线上更新过则冲突，默认用线上', () => {
    const remote = validContent()
    const draftContent = clone(remote)
    draftContent.home.claim = '改过的'
    const draft = makeDraft(draftContent, '2020-01-01T00:00:00.000Z')
    const r = resolveContent(remote, draft)
    expect(r.source).toBe('remote')
    expect(r.conflict).toBe(true)
    expect(r.content.home.claim).toBe(remote.home.claim)
  })
})

describe('migrate', () => {
  it('当前版本原样返回', () => {
    const c = validContent()
    expect(migrate(c).schemaVersion).toBe(1)
  })
  it('高版本抛错', () => {
    expect(() => migrate({ schemaVersion: 99 })).toThrow(MigrationError)
  })
  it('缺版本抛错', () => {
    expect(() => migrate({})).toThrow(MigrationError)
  })
  it('非对象抛错', () => {
    expect(() => migrate(null)).toThrow(MigrationError)
  })
})

describe('favorites', () => {
  it('加入收藏并去重', () => {
    const a = toggleInList([], 'episode', 'ep-1', '2026-01-01T00:00:00Z')
    expect(a.added).toBe(true)
    expect(a.list).toHaveLength(1)
    expect(isFav(a.list, 'episode', 'ep-1')).toBe(true)
  })
  it('再次点击取消收藏', () => {
    const a = toggleInList([], 'episode', 'ep-1')
    const b = toggleInList(a.list, 'episode', 'ep-1')
    expect(b.added).toBe(false)
    expect(b.list).toHaveLength(0)
  })
  it('不同类型同 ID 不互相影响', () => {
    const a = toggleInList([], 'episode', 'x-1')
    expect(isFav(a.list, 'extra', 'x-1')).toBe(false)
  })
})

describe('history', () => {
  it('同一集只保留一条并置顶', () => {
    let list = pushHistory([], 'episode', 'a', '2026-01-01T00:00:00Z')
    list = pushHistory(list, 'episode', 'b', '2026-01-02T00:00:00Z')
    list = pushHistory(list, 'episode', 'a', '2026-01-03T00:00:00Z')
    expect(list).toHaveLength(2)
    expect(list[0].id).toBe('a')
  })
  it(`最多保留 ${HISTORY_LIMIT} 条`, () => {
    let list: ReturnType<typeof pushHistory> = []
    for (let i = 0; i < HISTORY_LIMIT + 10; i += 1) {
      list = pushHistory(list, 'episode', `ep-${i}`)
    }
    expect(list).toHaveLength(HISTORY_LIMIT)
    expect(list[0].id).toBe(`ep-${HISTORY_LIMIT + 9}`)
  })
})
