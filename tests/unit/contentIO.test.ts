import { describe, it, expect } from 'vitest'
import {
  buildContentPack,
  buildBackup,
  canonicalContent,
  serialize,
  planImport,
  fileName,
  timestampSuffix,
} from '../../src/data/contentIO'
import { validContent } from '../fixtures'

describe('canonicalContent', () => {
  it('导出键顺序稳定', () => {
    const a = serialize(canonicalContent(validContent()))
    const b = serialize(canonicalContent(validContent()))
    expect(a).toBe(b)
    expect(a.indexOf('"schemaVersion"')).toBeLessThan(a.indexOf('"site"'))
    expect(a.indexOf('"site"')).toBeLessThan(a.indexOf('"members"'))
  })

  it('去掉多余字段', () => {
    const c = validContent() as any
    c.__extra = 'should be dropped'
    const out = canonicalContent(c) as any
    expect(out.__extra).toBeUndefined()
  })
})

describe('buildContentPack', () => {
  it('内容包不包含账号与收藏', () => {
    const pack = buildContentPack(validContent())
    const text = serialize(pack)
    expect(text).not.toContain('passwordHash')
    expect(text).not.toContain('favorites')
    expect(pack.kind).toBe('content')
  })
})

describe('buildBackup', () => {
  it('备份包含账号与收藏，密码是哈希', () => {
    const backup = buildBackup(
      validContent(),
      [
        {
          id: 'u-1',
          name: '导演',
          passwordHash: 'hash-xyz',
          salt: 'salt',
          role: 'admin',
          memberId: null,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      [{ type: 'episode', id: 'ep-1-1', at: '2026-01-01T00:00:00.000Z' }],
      [],
    )
    expect(backup.accounts).toHaveLength(1)
    expect(backup.favorites).toHaveLength(1)
    expect(serialize(backup)).toContain('hash-xyz')
  })
})

describe('文件名', () => {
  it('含日期时间', () => {
    const d = new Date('2026-11-20T15:03:00')
    expect(timestampSuffix(d)).toBe('20261120-1503')
    expect(fileName('content', d)).toBe('yacc-content-20261120-1503.json')
    expect(fileName('backup', d)).toBe('yacc-backup-20261120-1503.json')
  })
})

describe('planImport', () => {
  it('合法内容包可导入，并提示不含账号', () => {
    const pack = buildContentPack(validContent())
    const result = planImport(serialize(pack))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plan.kind).toBe('content')
      expect(result.plan.accounts).toHaveLength(0)
      expect(result.plan.warnings.join('')).toContain('账号')
    }
  })

  it('合法备份可导入', () => {
    const backup = buildBackup(validContent(), [], [], [])
    const result = planImport(serialize(backup))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.plan.kind).toBe('backup')
  })

  it('损坏的 JSON 被拒', () => {
    const result = planImport('{ not json ')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join('')).toContain('JSON')
  })

  it('悬空引用被拒', () => {
    const c = validContent()
    c.episodes[0].seasonId = 'nope'
    const result = planImport(serialize(c))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join('')).toContain('nope')
  })

  it('超大文件被拒', () => {
    const result = planImport('{}', 6 * 1024 * 1024)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join('')).toContain('5MB')
  })

  it('版本过高被拒', () => {
    const c = validContent() as any
    c.schemaVersion = 99
    const result = planImport(serialize(c))
    expect(result.ok).toBe(false)
  })
})
