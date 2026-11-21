import type { Platform } from '../data/schema'

export interface VideoRef {
  platform: Platform
  videoId: string
}

const BV = /BV[0-9A-Za-z]{10}/
const YT_ID = /^[A-Za-z0-9_-]{11}$/

/**
 * 从「链接」或「裸 ID」里解析出平台与视频 ID。
 * 解析不出来返回 null（调用方给出可读提示）。
 */
export function parseVideoInput(input: string): VideoRef | null {
  const raw = input.trim()
  if (!raw) return null

  // 裸 BV 号
  if (/^BV[0-9A-Za-z]{10}$/.test(raw)) {
    return { platform: 'bilibili', videoId: raw }
  }

  // 裸 YouTube ID
  if (YT_ID.test(raw) && !/^BV/.test(raw)) {
    return { platform: 'youtube', videoId: raw }
  }

  let url: URL
  try {
    url = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
  } catch {
    return null
  }
  const host = url.hostname.replace(/^www\./, '')

  if (host === 'bilibili.com' || host === 'm.bilibili.com' || host === 'player.bilibili.com') {
    const match = BV.exec(url.pathname + url.search)
    if (match) return { platform: 'bilibili', videoId: match[0] }
    return null
  }

  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0]
    if (id && YT_ID.test(id)) return { platform: 'youtube', videoId: id }
    return null
  }

  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    const v = url.searchParams.get('v')
    if (v && YT_ID.test(v)) return { platform: 'youtube', videoId: v }
    const parts = url.pathname.split('/').filter(Boolean)
    if ((parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live') && parts[1]) {
      if (YT_ID.test(parts[1])) return { platform: 'youtube', videoId: parts[1] }
    }
    return null
  }

  return null
}

/** 还没换成真实链接的占位视频 */
const PLACEHOLDER_IDS = new Set(['BV1xx411c7mD'])

export function isPlaceholderVideo(ref: VideoRef): boolean {
  return PLACEHOLDER_IDS.has(ref.videoId)
}

export function embedUrl(ref: VideoRef): string {
  if (ref.platform === 'bilibili') {
    const params = new URLSearchParams({
      bvid: ref.videoId,
      page: '1',
      high_quality: '1',
      danmaku: '0',
      autoplay: '0',
      as_wide: '1',
    })
    return `https://player.bilibili.com/player.html?${params.toString()}`
  }
  return `https://www.youtube-nocookie.com/embed/${ref.videoId}?rel=0&modestbranding=1`
}

export function watchUrl(ref: VideoRef): string {
  return ref.platform === 'bilibili'
    ? `https://www.bilibili.com/video/${ref.videoId}`
    : `https://www.youtube.com/watch?v=${ref.videoId}`
}
