import type { HistoryRef } from './schema'
import { HISTORY_KEY } from './schema'
import { storageDel, storageGet, storageSet } from './storage'

export const HISTORY_LIMIT = 50

export async function listHistory(): Promise<HistoryRef[]> {
  const list = await storageGet<HistoryRef[]>(HISTORY_KEY)
  return Array.isArray(list) ? list : []
}

export function pushHistory(
  list: HistoryRef[],
  type: HistoryRef['type'],
  id: string,
  now = new Date().toISOString(),
  limit = HISTORY_LIMIT,
): HistoryRef[] {
  const rest = list.filter((h) => !(h.type === type && h.id === id))
  return [{ type, id, at: now }, ...rest].slice(0, limit)
}

export async function recordHistory(
  type: HistoryRef['type'],
  id: string,
): Promise<HistoryRef[]> {
  const list = await listHistory()
  const next = pushHistory(list, type, id)
  await storageSet(HISTORY_KEY, next)
  return next
}

export async function clearHistory(): Promise<void> {
  await storageDel(HISTORY_KEY)
}

export async function saveHistory(list: HistoryRef[]): Promise<void> {
  await storageSet(HISTORY_KEY, list)
}
