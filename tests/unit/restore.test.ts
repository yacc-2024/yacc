import { describe, it, expect, beforeEach } from 'vitest'
import {
  applyRestore,
  applyRollback,
  commitPendingRestore,
  hasPendingRestore,
  loadRollback,
} from '../../src/data/restore'
import { __resetStorage, storageGet, storageSet, storageDel } from '../../src/data/storage'
import {
  ACCOUNTS_KEY,
  DRAFT_KEY,
  FAV_KEY,
  HISTORY_KEY,
  type Account,
  type Content,
  type Draft,
} from '../../src/data/schema'
import { validContent, clone } from '../fixtures'
import { buildBackup, planImport, serialize } from '../../src/data/contentIO'

const ACCOUNT: Account = {
  id: 'u-1',
  name: '导演',
  passwordHash: 'hash',
  salt: 'salt',
  role: 'admin',
  memberId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
}

beforeEach(() => {
  __resetStorage()
})

async function setDraft(content: Content) {
  const draft: Draft = {
    content,
    updatedAt: new Date().toISOString(),
    baseUpdatedAt: content.updatedAt,
  }
  await storageSet(DRAFT_KEY, draft)
}

async function readDraft(): Promise<Draft | null> {
  return (await storageGet<Draft>(DRAFT_KEY)) ?? null
}

describe('导入的原子性', () => {
  it('导入后内容、账号、收藏、历史都落盘', async () => {
    const content = validContent()
    content.home.claim = '导入进来的'
    await applyRestore({
      content,
      accounts: [ACCOUNT],
      favorites: [{ type: 'episode', id: 'ep-1-1', at: '2026-01-01T00:00:00.000Z' }],
      history: [{ type: 'episode', id: 'ep-1-1', at: '2026-01-01T00:00:00.000Z' }],
    })

    const draft = await readDraft()
    expect(draft?.content.home.claim).toBe('导入进来的')
    expect((await storageGet<Account[]>(ACCOUNTS_KEY))?.length).toBe(1)
    expect((await storageGet<unknown[]>(FAV_KEY))?.length).toBe(1)
    expect((await storageGet<unknown[]>(HISTORY_KEY))?.length).toBe(1)
    expect(await hasPendingRestore()).toBe(false)
  })

  it('中途被打断：pending 还在时，启动能补完', async () => {
    const content = validContent()
    content.home.claim = '半途的导入'
    // 模拟：pending 写了，正式数据没写
    await storageSet('yacc:restore-pending', {
      content,
      accounts: [ACCOUNT],
      favorites: [],
      history: [],
      token: Date.now(),
    })
    expect(await readDraft()).toBeNull()

    const done = await commitPendingRestore()
    expect(done).toBe(true)
    expect((await readDraft())?.content.home.claim).toBe('半途的导入')
    expect(await hasPendingRestore()).toBe(false)
  })
})

describe('撤销上一次导入', () => {
  it('回滚快照记录的是导入"之前"的状态', async () => {
    const before = validContent()
    before.home.claim = '导入前'
    await setDraft(before)
    await storageSet(ACCOUNTS_KEY, [ACCOUNT])

    const after = validContent()
    after.home.claim = '导入后'
    await applyRestore({ content: after, accounts: [], favorites: [], history: [] })

    const snap = await loadRollback()
    expect(snap?.content?.home.claim).toBe('导入前')
    expect(snap?.accounts).toHaveLength(1)
  })

  it('撤销后回到导入前，并且回滚点被清掉', async () => {
    const before = validContent()
    before.home.claim = '导入前'
    await setDraft(before)

    const after = validContent()
    after.home.claim = '导入后'
    await applyRestore({ content: after, accounts: [], favorites: [], history: [] })
    expect((await readDraft())?.content.home.claim).toBe('导入后')

    const ok = await applyRollback()
    expect(ok).toBe(true)
    expect((await readDraft())?.content.home.claim).toBe('导入前')
    expect(await loadRollback()).toBeNull()
  })

  it('没有回滚点时返回 false', async () => {
    expect(await applyRollback()).toBe(false)
  })

  it('导入前本来没有草稿：撤销后不留下内容', async () => {
    await storageDel(DRAFT_KEY)
    const after = validContent()
    await applyRestore({ content: after, accounts: [ACCOUNT], favorites: [], history: [] })

    const ok = await applyRollback()
    expect(ok).toBe(true)
    expect(await readDraft()).toBeNull()
  })
})

describe('导出 -> 导入 全链路', () => {
  it('完整备份导出再导入内容一致', async () => {
    const content = clone(validContent())
    content.home.claim = '往返测试'
    await setDraft(content)

    const backup = buildBackup(
      content,
      [ACCOUNT],
      [{ type: 'episode', id: 'ep-2-3', at: '2026-01-01T00:00:00.000Z' }],
      [],
    )
    const text = serialize(backup)
    const parsed = planImport(text)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    await applyRestore({
      content: parsed.plan.content,
      accounts: parsed.plan.accounts,
      favorites: parsed.plan.favorites,
      history: parsed.plan.history,
    })

    const draft = await readDraft()
    expect(draft?.content.home.claim).toBe('往返测试')
    expect(draft?.content.members.length).toBe(content.members.length)
    expect((await storageGet<Account[]>(ACCOUNTS_KEY))?.[0].name).toBe('导演')
    expect((await storageGet<unknown[]>(FAV_KEY))?.length).toBe(1)
  })
})
