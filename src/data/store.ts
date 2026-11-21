import type { Content, Draft } from './schema'
import { validateContent } from './validate'
import { migrate } from './migrate'
import { loadDraft } from './draft'

export interface LoadResult {
  content: Content
  source: 'remote' | 'draft' | 'fallback'
  conflict: boolean
  errors: string[]
}

/** 比较两份内容是否一致（忽略 updatedAt） */
export function sameContent(a: Content, b: Content): boolean {
  const strip = (c: Content) => {
    const { updatedAt: _ignored, ...rest } = c
    return rest
  }
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b))
}

/** 纯函数：给定线上内容与本地草稿，决定用哪个 */
export function resolveContent(remote: Content, draft: Draft | null): LoadResult {
  if (!draft) {
    return { content: remote, source: 'remote', conflict: false, errors: [] }
  }
  if (draft.baseUpdatedAt !== remote.updatedAt) {
    // 已经发布过、线上和草稿内容一致：不算冲突
    if (sameContent(draft.content, remote)) {
      return { content: remote, source: 'remote', conflict: false, errors: [] }
    }
    // 线上已更新过，草稿可能覆盖别人的改动 —— 默认用线上，提示冲突
    return {
      content: remote,
      source: 'remote',
      conflict: true,
      errors: [],
    }
  }
  return {
    content: draft.content,
    source: 'draft',
    conflict: false,
    errors: [],
  }
}

export function useDraftContent(draft: Draft): LoadResult {
  return { content: draft.content, source: 'draft', conflict: false, errors: [] }
}

/** 把任意来源的原始内容归一化（迁移 + 校验）；失败时抛出 */
export function normaliseContent(raw: unknown): Content {
  const migrated = migrate(raw)
  const result = validateContent(migrated)
  if (!result.ok) {
    throw new Error(`内容校验失败：${result.errors.slice(0, 3).join('；')}`)
  }
  return result.data
}

/** 从网络读取线上内容；失败时抛出，由调用方兜底 */
export async function fetchRemoteContent(
  fetcher: typeof fetch = fetch,
  url = '/content.json',
): Promise<Content> {
  const res = await fetcher(url, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const raw: unknown = await res.json()
  return normaliseContent(raw)
}

export async function loadContent(
  fetcher?: typeof fetch,
): Promise<LoadResult> {
  const draft = await loadDraft()
  const remote = await fetchRemoteContent(fetcher)
  return resolveContent(remote, draft)
}
