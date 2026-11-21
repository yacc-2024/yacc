import { describe, it, expect } from 'vitest'
import { parseVideoInput, embedUrl, watchUrl } from '../../src/lib/video'

describe('parseVideoInput', () => {
  it('裸 BV 号', () => {
    expect(parseVideoInput('BV1xx411c7mD')).toEqual({
      platform: 'bilibili',
      videoId: 'BV1xx411c7mD',
    })
  })

  it('标准 B 站链接', () => {
    expect(parseVideoInput('https://www.bilibili.com/video/BV1xx411c7mD')).toEqual({
      platform: 'bilibili',
      videoId: 'BV1xx411c7mD',
    })
  })

  it('带 spm 参数和分P', () => {
    expect(
      parseVideoInput('https://www.bilibili.com/video/BV1xx411c7mD?spm_id_from=333.999&p=2'),
    ).toEqual({ platform: 'bilibili', videoId: 'BV1xx411c7mD' })
  })

  it('m 站链接', () => {
    expect(parseVideoInput('https://m.bilibili.com/video/BV1xx411c7mD')).toEqual({
      platform: 'bilibili',
      videoId: 'BV1xx411c7mD',
    })
  })

  it('youtu.be 短链', () => {
    expect(parseVideoInput('https://youtu.be/dQw4w9WgXcQ')).toEqual({
      platform: 'youtube',
      videoId: 'dQw4w9WgXcQ',
    })
  })

  it('youtube watch 链接', () => {
    expect(parseVideoInput('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10')).toEqual({
      platform: 'youtube',
      videoId: 'dQw4w9WgXcQ',
    })
  })

  it('youtube shorts', () => {
    expect(parseVideoInput('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toEqual({
      platform: 'youtube',
      videoId: 'dQw4w9WgXcQ',
    })
  })

  it('不认识的站点返回 null', () => {
    expect(parseVideoInput('https://example.com/video/123')).toBeNull()
  })

  it('空字符串返回 null', () => {
    expect(parseVideoInput('   ')).toBeNull()
  })

  it('不是链接也不是 ID 返回 null', () => {
    expect(parseVideoInput('随便写的')).toBeNull()
  })
})

describe('embedUrl', () => {
  it('B 站关闭弹幕与自动播放', () => {
    const url = embedUrl({ platform: 'bilibili', videoId: 'BV1xx411c7mD' })
    expect(url).toContain('bvid=BV1xx411c7mD')
    expect(url).toContain('danmaku=0')
    expect(url).toContain('autoplay=0')
  })
  it('YouTube 用 nocookie 域', () => {
    const url = embedUrl({ platform: 'youtube', videoId: 'dQw4w9WgXcQ' })
    expect(url).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ')
  })
})

describe('watchUrl', () => {
  it('B 站', () =>
    expect(watchUrl({ platform: 'bilibili', videoId: 'BV1xx411c7mD' })).toBe(
      'https://www.bilibili.com/video/BV1xx411c7mD',
    ))
  it('YouTube', () =>
    expect(watchUrl({ platform: 'youtube', videoId: 'dQw4w9WgXcQ' })).toBe(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    ))
})
