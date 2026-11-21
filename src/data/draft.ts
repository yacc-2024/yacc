import type { Content, Draft } from './schema'
import { DRAFT_KEY } from './schema'
import { storageDel, storageGet, storageSet } from './storage'

export async function loadDraft(): Promise<Draft | null> {
  const d = await storageGet<Draft>(DRAFT_KEY)
  if (!d || typeof d !== 'object') return null
  if (!d.content || typeof d.updatedAt !== 'string') return null
  return d
}

export async function saveDraft(draft: Draft): Promise<void> {
  await storageSet(DRAFT_KEY, draft)
}

export async function clearDraft(): Promise<void> {
  await storageDel(DRAFT_KEY)
}

export function makeDraft(content: Content, baseUpdatedAt: string): Draft {
  return {
    content,
    updatedAt: new Date().toISOString(),
    baseUpdatedAt,
  }
}
