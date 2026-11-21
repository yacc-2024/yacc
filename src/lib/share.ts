export type ShareOutcome = 'shared' | 'copied' | 'failed'

export async function shareOrCopy(payload: {
  title: string
  text?: string
  url: string
}): Promise<ShareOutcome> {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share(payload)
      return 'shared'
    }
  } catch {
    // 用户取消或平台不支持，继续走复制
  }
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(payload.url)
      return 'copied'
    }
  } catch {
    /* 继续降级 */
  }
  return 'failed'
}
