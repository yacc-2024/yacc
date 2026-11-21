import { Link, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useApp } from '../state/AppContext'
import { NavBar, Chip, EmptyState, Avatar } from '../components/ui'
import { Icon } from '../components/Icon'
import { rolesOf, seasonsSorted } from '../lib/selectors'
import type { Member } from '../data/schema'
import { api } from '../lib/api'

export interface MemberLink {
  memberId: string
  uid: string
  name: string
  avatar: string | null
}

/** 成员 → 账号 的映射；没有账号的成员显示成灰色 */
export function useMemberLinks(online: boolean) {
  const [links, setLinks] = useState<Record<string, MemberLink>>({})
  useEffect(() => {
    if (!online) return
    let alive = true
    void api
      .memberLinks()
      .then((res) => {
        if (!alive) return
        const map: Record<string, MemberLink> = {}
        for (const item of res.links) map[item.memberId] = item
        setLinks(map)
      })
      .catch(() => {
        /* 离线或没有账号时静默 */
      })
    return () => {
      alive = false
    }
  }, [online])
  return links
}

export function LoginGate({
  title = '成员名单仅剧组内部可见',
  desc = '登录后可以查看全部成员、分工和拍摄安排。',
}: {
  title?: string
  desc?: string
}) {
  return (
    <div className="page__body">
      <div
        className="card"
        style={{ marginTop: 24, textAlign: 'center', padding: '32px 20px' }}
      >
        <span
          className="empty__art"
          style={{ margin: '0 auto 12px', display: 'grid' }}
        >
          <Icon name="lock" size={26} />
        </span>
        <p className="t-title3">{title}</p>
        <p className="t-caption" style={{ marginTop: 6 }}>
          {desc}
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
          <Link to="/login" className="btn btn--primary" style={{ flex: 1 }}>
            登录
          </Link>
          <Link to="/login?mode=register" className="btn btn--ghost" style={{ flex: 1 }}>
            用认证密钥注册
          </Link>
        </div>
      </div>
    </div>
  )
}

function MemberCard({ m, link }: { m: Member; link?: MemberLink }) {
  return (
    <Link to={link ? `/u/${link.uid}` : `/members/${m.id}`} className="member">
      <Avatar name={m.name} src={link?.avatar ?? m.avatar} size={88} />
      {link ? <span className="member__badge">已注册</span> : null}
      <span className="member__name clamp-1">{m.name}</span>
      <span className="member__role">
        {m.roles.join(' · ')}
        {' · '}
        {m.seasons.map((s) => `第${s}季`).join(' ')}
      </span>
    </Link>
  )
}

export function Members() {
  const { content, account, mode } = useApp()
  const c = content!
  const [params, setParams] = useSearchParams()
  const links = useMemberLinks(mode === 'online' && !!account)

  const role = params.get('role')
  const season = params.get('season')
  const seasonNo = season ? Number(season) : null

  const toggle = (key: 'role' | 'season', value: string | null) => {
    const next = new URLSearchParams(params)
    const cur = next.get(key)
    if (value === null || cur === value) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  if (!account) {
    return (
      <>
        <NavBar title="成员" large />
        <LoginGate />
      </>
    )
  }

  const filtered = c.members.filter((m) => {
    if (role && !m.roles.includes(role)) return false
    if (seasonNo && !m.seasons.includes(seasonNo)) return false
    return true
  })

  const seasons = seasonsSorted(c)
  const hasFilter = Boolean(role || season)

  const unassigned = filtered.filter((m) => m.seasons.length === 0)
  const groups = hasFilter
    ? [{ key: 'all', title: '', list: filtered }]
    : [
        ...seasons.map((s) => ({
          key: s.id,
          title: `${s.title}成员 · ${filtered.filter((m) => m.seasons.includes(s.no)).length} 人`,
          list: filtered.filter((m) => m.seasons.includes(s.no)),
        })),
        ...(unassigned.length > 0
          ? [{ key: 'none', title: `未分季 · ${unassigned.length} 人`, list: unassigned }]
          : []),
      ]

  return (
    <>
      <NavBar
        title="成员"
        large
        action={
          (account.role === 'admin' || account.role === 'superadmin') ? (
            <Link to="/admin/members" className="nav__action" aria-label="管理成员">
              <Icon name="edit" size={21} />
            </Link>
          ) : null
        }
      />

      <div style={{ padding: '0 var(--gutter)' }}>
        <div className="chips" role="group" aria-label="按季筛选">
          <Chip active={!seasonNo} onClick={() => toggle('season', null)}>
            全部
          </Chip>
          {seasons.map((s) => (
            <Chip
              key={s.id}
              active={seasonNo === s.no}
              onClick={() => toggle('season', String(s.no))}
            >
              {s.title}
            </Chip>
          ))}
        </div>
        <div className="chips" role="group" aria-label="按分工筛选" style={{ marginTop: 8 }}>
          <Chip active={!role} onClick={() => toggle('role', null)}>
            全部分工
          </Chip>
          {rolesOf(c).map((r) => (
            <Chip key={r} active={role === r} onClick={() => toggle('role', r)}>
              {r}
            </Chip>
          ))}
        </div>
        {hasFilter ? (
          <div style={{ textAlign: 'right', marginTop: 4 }}>
            <button
              type="button"
              className="linklike"
              onClick={() => setParams(new URLSearchParams(), { replace: true })}
            >
              清除
            </button>
          </div>
        ) : null}
      </div>

      <div className="page__body" style={{ marginTop: 12 }}>
        {filtered.length === 0 ? (
          <EmptyState
            icon="users"
            title="这个筛选下还没有人"
            desc="换个条件看看。"
            action={
              <button
                type="button"
                className="btn btn--ghost"
                style={{ marginTop: 8 }}
                onClick={() => setParams(new URLSearchParams(), { replace: true })}
              >
                清除筛选
              </button>
            }
          />
        ) : (
          groups.map((g) => (
            <section key={g.key} style={{ marginBottom: 24 }}>
              {g.title ? (
                <h2 className="t-caption faint" style={{ marginBottom: 10, fontWeight: 600 }}>
                  {g.title}
                </h2>
              ) : null}
              <div className="grid-2">
                {g.list.map((m) => (
                  <MemberCard key={`${g.key}-${m.id}`} m={m} link={links[m.id]} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </>
  )
}
