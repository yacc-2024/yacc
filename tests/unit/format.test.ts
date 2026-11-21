import { describe, it, expect } from 'vitest'
import {
  formatDuration,
  parseDuration,
  formatDate,
  formatShortDate,
  formatDateBlock,
  eventStatus,
  sortEvents,
  sortAnnouncements,
  sortMembers,
  relativeDay,
} from '../../src/lib/format'
import type { CrewEvent } from '../../src/data/schema'

describe('formatDuration', () => {
  it('0 秒', () => expect(formatDuration(0)).toBe('00:00'))
  it('754 秒', () => expect(formatDuration(754)).toBe('12:34'))
  it('3671 秒跨小时', () => expect(formatDuration(3671)).toBe('01:01:11'))
  it('负数按 0 处理', () => expect(formatDuration(-5)).toBe('00:00'))
})

describe('parseDuration', () => {
  it('12:34', () => expect(parseDuration('12:34')).toBe(754))
  it('1:01:11', () => expect(parseDuration('1:01:11')).toBe(3671))
  it('8 当分钟', () => expect(parseDuration('8')).toBe(480))
  it('空字符串为 0', () => expect(parseDuration('')).toBe(0))
  it('非法返回 null', () => expect(parseDuration('abc')).toBeNull())
  it('和 formatDuration 互逆', () => {
    expect(parseDuration(formatDuration(754))).toBe(754)
    expect(parseDuration(formatDuration(3671))).toBe(3671)
  })
})

describe('日期格式', () => {
  it('formatDate', () => expect(formatDate('2026-11-18')).toBe('2026.11.18'))
  it('formatShortDate', () => expect(formatShortDate('2026-11-18')).toBe('11/18'))
  it('formatDateBlock', () =>
    expect(formatDateBlock('2026-11-18')).toEqual({ month: '11月', day: '18' }))
})

describe('eventStatus', () => {
  const ev: CrewEvent = {
    id: 'e',
    title: 't',
    startAt: '2026-11-22T14:00:00+08:00',
    endAt: '2026-11-22T17:00:00+08:00',
    placePublic: '',
    placePrivate: '',
    mapQuery: '',
    note: '',
  }
  it('未开始', () =>
    expect(eventStatus(ev, new Date('2026-11-20T10:00:00+08:00'))).toBe('upcoming'))
  it('进行中', () =>
    expect(eventStatus(ev, new Date('2026-11-22T15:00:00+08:00'))).toBe('ongoing'))
  it('已结束', () =>
    expect(eventStatus(ev, new Date('2026-11-23T10:00:00+08:00'))).toBe('past'))
})

describe('sortEvents', () => {
  const make = (id: string, start: string, end = start): CrewEvent => ({
    id,
    title: id,
    startAt: start,
    endAt: end,
    placePublic: '',
    placePrivate: '',
    mapQuery: '',
    note: '',
  })
  it('进行中 > 未开始 > 已结束', () => {
    const now = new Date('2026-11-22T15:00:00+08:00')
    const list = [
      make('past', '2026-11-01T10:00:00+08:00'),
      make('future', '2026-12-01T10:00:00+08:00'),
      make('now', '2026-11-22T14:00:00+08:00', '2026-11-22T17:00:00+08:00'),
    ]
    expect(sortEvents(list, now).map((e) => e.id)).toEqual(['now', 'future', 'past'])
  })
})

describe('sortAnnouncements', () => {
  it('置顶优先，其余按日期倒序', () => {
    const list = [
      { pinned: false, date: '2026-11-01' },
      { pinned: true, date: '2026-10-01' },
      { pinned: false, date: '2026-11-10' },
    ]
    expect(sortAnnouncements(list).map((x) => x.date)).toEqual([
      '2026-10-01',
      '2026-11-10',
      '2026-11-01',
    ])
  })
})

describe('sortMembers', () => {
  it('按 order 排序', () => {
    const list = [
      { order: 3, name: 'c' },
      { order: 1, name: 'a' },
      { order: 2, name: 'b' },
    ]
    expect(sortMembers(list).map((m) => m.name)).toEqual(['a', 'b', 'c'])
  })
})

describe('relativeDay', () => {
  const now = new Date('2026-11-20T10:00:00+08:00')
  it('今天', () => expect(relativeDay('2026-11-20T10:00:00+08:00', now)).toBe('今天'))
  it('明天', () => expect(relativeDay('2026-11-21T10:00:00+08:00', now)).toBe('明天'))
  it('昨天', () => expect(relativeDay('2026-11-19T10:00:00+08:00', now)).toBe('昨天'))
  it('下周显示日期', () =>
    expect(relativeDay('2026-10-02T10:00:00+08:00', now)).toBe('10/02'))
})
