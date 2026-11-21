import type { FavRef } from './schema'
import { FAV_KEY } from './schema'
import { storageGet, storageSet } from './storage'

export async function listFavorites(): Promise<FavRef[]> {
  const list = await storageGet<FavRef[]>(FAV_KEY)
  return Array.isArray(list) ? list : []
}

export function isFav(list: FavRef[], type: FavRef['type'], id: string): boolean {
  return list.some((f) => f.type === type && f.id === id)
}

export function toggleInList(
  list: FavRef[],
  type: FavRef['type'],
  id: string,
  now = new Date().toISOString(),
): { list: FavRef[]; added: boolean } {
  if (isFav(list, type, id)) {
    return { list: list.filter((f) => !(f.type === type && f.id === id)), added: false }
  }
  return { list: [{ type, id, at: now }, ...list], added: true }
}

export async function toggleFavorite(
  type: FavRef['type'],
  id: string,
): Promise<{ list: FavRef[]; added: boolean }> {
  const list = await listFavorites()
  const next = toggleInList(list, type, id)
  await storageSet(FAV_KEY, next.list)
  return next
}

export async function saveFavorites(list: FavRef[]): Promise<void> {
  await storageSet(FAV_KEY, list)
}
