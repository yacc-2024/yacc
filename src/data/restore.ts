import type { Account, Content, Draft, FavRef, HistoryRef } from './schema'
import {
  ACCOUNTS_KEY,
  DRAFT_KEY,
  FAV_KEY,
  HISTORY_KEY,
  ROLLBACK_KEY,
} from './schema'
import { storageDel, storageGet, storageSet } from './storage'

const PENDING_KEY = 'yacc:restore-pending'

export interface RestorePayload {
  content: Content
  accounts: Account[]
  favorites: FavRef[]
  history: HistoryRef[]
}

interface Pending extends RestorePayload {
  token: number
}

export interface RollbackSnapshot {
  content: Content | null
  accounts: Account[]
  favorites: FavRef[]
  history: HistoryRef[]
  at: string
}

/**
 * 导入的原子性：
 * 1. 先把「导入前的状态」存成回滚快照
 * 2. 把整包写进 pending
 * 3. 逐个正式落盘，最后清掉 pending
 * 中途被杀进程，下次启动会发现 pending 并补写完整。
 */
export async function applyRestore(payload: RestorePayload): Promise<void> {
  const previous = await captureCurrent()
  await storageSet(ROLLBACK_KEY, previous)

  const pending: Pending = { ...payload, token: Date.now() }
  await storageSet(PENDING_KEY, pending)
  await commitPendingRestore()
}

async function captureCurrent(): Promise<RollbackSnapshot> {
  const draft = await storageGet<Draft>(DRAFT_KEY)
  return {
    content: draft?.content ?? null,
    accounts: (await storageGet<Account[]>(ACCOUNTS_KEY)) ?? [],
    favorites: (await storageGet<FavRef[]>(FAV_KEY)) ?? [],
    history: (await storageGet<HistoryRef[]>(HISTORY_KEY)) ?? [],
    at: new Date().toISOString(),
  }
}

export async function commitPendingRestore(): Promise<boolean> {
  const pending = await storageGet<Pending>(PENDING_KEY)
  if (!pending || !pending.content) return false
  await storageSet(DRAFT_KEY, {
    content: pending.content,
    updatedAt: new Date().toISOString(),
    baseUpdatedAt: pending.content.updatedAt,
  })
  await storageSet(ACCOUNTS_KEY, pending.accounts ?? [])
  await storageSet(FAV_KEY, pending.favorites ?? [])
  await storageSet(HISTORY_KEY, pending.history ?? [])
  await storageDel(PENDING_KEY)
  return true
}

export async function hasPendingRestore(): Promise<boolean> {
  return !!(await storageGet<Pending>(PENDING_KEY))
}

/* ---------------- 撤销上一次导入 ---------------- */

export async function loadRollback(): Promise<RollbackSnapshot | null> {
  const snap = await storageGet<RollbackSnapshot>(ROLLBACK_KEY)
  if (!snap || typeof snap !== 'object') return null
  return snap
}

export async function applyRollback(): Promise<boolean> {
  const snap = await loadRollback()
  if (!snap) return false
  if (snap.content) {
    await applyRestore({
      content: snap.content,
      accounts: snap.accounts ?? [],
      favorites: snap.favorites ?? [],
      history: snap.history ?? [],
    })
  } else {
    await storageSet(ACCOUNTS_KEY, snap.accounts ?? [])
    await storageSet(FAV_KEY, snap.favorites ?? [])
    await storageSet(HISTORY_KEY, snap.history ?? [])
    await storageDel(DRAFT_KEY)
  }
  // 撤销本身不该再产生新的回滚点
  await storageDel(ROLLBACK_KEY)
  return true
}
