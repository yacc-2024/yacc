import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../../state/AppContext'
import { NavBar, Segmented, EmptyState, useConfirm, Avatar, Sheet } from '../../components/ui'
import { useBulk, Pick, BulkBar, useBulkDelete } from '../../components/BulkSelect'
import { PERM_GROUPS, expandPerms } from '../../lib/perms'
import { BADGE_STYLES, Badge } from '../../components/Badge'
import { DirtyBanner } from '../../components/DirtyBanner'
import { api, type AdminPerm } from '../../lib/api'
import { formatDate } from '../../lib/format'
import { Icon } from '../../components/Icon'

/* ============================================================
   密钥管理
   ============================================================ */

interface KeyRow {
  code: string
  kind: string
  spec: string | null
  specLabel: string
  note: string
  createdAt: string
  usedAt: string | null
  usedBy: string | null
  expiresAt: string | null
}



const CREW_ROLE_DIGITS: Record<string, number> = {
  导演: 1,
  编剧: 2,
  剪辑: 3,
  摄影: 4,
  演员: 5,
}

export function KeysPanel() {
  const { mode, toast, account, content } = useApp()
  const members = content?.members ?? []
  const isSuper = account?.role === 'superadmin'
  const confirm = useConfirm()
  const [keys, setKeys] = useState<KeyRow[]>([])
  const bulk = useBulk<string>()
  const askBulkDelete = useBulkDelete()
  const [bulkBusy, setBulkBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [kind, setKind] = useState<'crew' | 'member' | 'admin'>('member')
  const [perms, setPerms] = useState<string[]>(['content:publish'])
  const [memberId, setMemberId] = useState('')
  const [grade, setGrade] = useState(8)
  const [klass, setKlass] = useState(7)
  const [count, setCount] = useState(5)
  const [days, setDays] = useState(30)
  const [note, setNote] = useState('')
  const [fresh, setFresh] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (mode !== 'online') {
      setLoading(false)
      return
    }
    try {
      const res = await api.admin.keys()
      setKeys(Array.isArray(res.keys) ? res.keys : [])
    } catch (err) {
      toast(err instanceof Error ? err.message : '加载失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [mode, toast])

  useEffect(() => {
    void load()
  }, [load])

  if (mode !== 'online') {
    return (
      <EmptyState
        icon="lock"
        title="现在是离线模式"
        desc="密钥管理需要后端服务。"
      />
    )
  }

  const generate = async () => {
    setBusy(true)
    try {
      let spec:
        | { kind: 'admin'; perms: AdminPerm[] }
        | {
            kind: 'crew'
            role: number
            season: number
            memberId?: string
            memberName?: string
          }
        | { kind: 'member'; grade: number; klass: number }
      if (kind === 'admin') {
        spec = { kind: 'admin', perms: perms as AdminPerm[] }
      } else if (kind === 'crew') {
        const member = members.find((m) => m.id === memberId)
        if (!member) {
          toast('先选一个成员', 'error')
          return
        }
        const roleDigit = CREW_ROLE_DIGITS[member.roles[0] ?? ''] ?? 5
        const seasonDigit =
          member.seasons.includes(1) && member.seasons.includes(2)
            ? 9
            : member.seasons[0] === 2
              ? 2
              : 1
        spec = {
          kind: 'crew',
          role: roleDigit,
          season: seasonDigit,
          memberId: member.id,
          memberName: member.name,
        }
      } else {
        spec = { kind: 'member', grade, klass }
      }
      const res = await api.admin.createKeys(spec, count, days, note)
      setFresh(res.keys)
      toast(`生成了 ${res.keys.length} 个密钥`)
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : '生成失败', 'error')
    } finally {
      setBusy(false)
    }
  }

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(fresh.join('\n'))
      toast('已复制，可以直接发到群里')
    } catch {
      toast('复制失败，手动选吧', 'error')
    }
  }

  const revoke = async (code: string) => {
    const ok = await confirm({
      title: '作废这个密钥？',
      message: '作废后这个密钥就无法再注册了。',
      confirmText: '作废',
      danger: true,
    })
    if (!ok) return
    try {
      await api.admin.revokeKey(code)
      await load()
      toast('已作废')
    } catch (err) {
      toast(err instanceof Error ? err.message : '操作失败', 'error')
    }
  }

  const removeMany = async () => {
    if (bulk.count === 0) return
    const ok = await askBulkDelete(bulk.count, '个密钥')
    if (!ok) return
    setBulkBusy(true)
    try {
      const picked = [...bulk.list]
      for (const code of picked) await api.admin.revokeKey(code)
      setKeys((prev) => prev.filter((k) => !picked.includes(k.code)))
      toast(`已删除 ${picked.length} 个密钥`)
      bulk.exit()
    } catch (err) {
      toast(err instanceof Error ? err.message : '删除失败', 'error')
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <>
      <DirtyBanner />
      <div className="page__body">
        <p className="t-caption faint" style={{ marginTop: 8, lineHeight: 1.6 }}>
          密钥就是「学校认证」的凭证。拿到密钥注册的人就是认证访客，能看、能评论、能点赞；
          没有密钥的人是普通访客，只能看。每个密钥只能用一次。
        </p>

        <div className="card" style={{ marginTop: 16 }}>
          <Segmented<'crew' | 'member' | 'admin'>
            label="密钥类型"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'member', label: '认证成员' },
              { value: 'crew', label: '剧组成员' },
              ...(isSuper ? [{ value: 'admin' as const, label: '管理员' }] : []),
            ]}
          />

          {kind === 'admin' ? (
            <>
              <p className="field__label" style={{ marginTop: 16 }}>
                这名管理员可以做什么
              </p>
              {PERM_GROUPS.map((group) => {
                const values = group.items.map(([v]) => v)
                const allOn = values.every((v) => perms.includes(v))
                return (
                <div key={group.title} style={{ marginTop: 10 }}>
                  <div className="between" style={{ marginBottom: 6 }}>
                    <span className="t-tag faint">{group.title}</span>
                    <button
                      type="button"
                      className="linklike"
                      style={{ fontSize: 11 }}
                      onClick={() =>
                        setPerms((prev) =>
                          allOn
                            ? prev.filter((p) => !values.includes(p))
                            : Array.from(new Set([...prev, ...values])),
                        )
                      }
                    >
                      {allOn ? '取消全选' : '全选'}
                    </button>
                  </div>
                  <div className="chips">
                    {group.items.map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        className="chip"
                        aria-pressed={perms.includes(value)}
                        onClick={() =>
                          setPerms((prev) =>
                            prev.includes(value)
                              ? prev.filter((p) => p !== value)
                              : [...prev, value],
                          )
                        }
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                )
              })}
            </>
          ) : kind === 'crew' ? (
            <>
              <p className="field__label" style={{ marginTop: 16 }}>
                绑定哪个成员
              </p>
              <p className="field__hint" style={{ marginTop: 2 }}>
                密钥发给这个成员，他注册后成员页会显示他的主页。
              </p>
              <div className="chips" style={{ maxHeight: 190, overflowY: 'auto' }}>
                {members.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="chip"
                    aria-pressed={memberId === m.id}
                    onClick={() => setMemberId(m.id)}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
              {members.length === 0 ? (
                <p className="field__hint">还没有成员，先去「成员管理」加人。</p>
              ) : null}
            </>
          ) : (
            <div className="row gap-3" style={{ marginTop: 16 }}>
              <label className="grow">
                <span className="field__label">年级（编号第 2 位）</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={9}
                  value={grade}
                  aria-label="年级"
                  onChange={(e) => setGrade(Number(e.target.value))}
                />
              </label>
              <label className="grow">
                <span className="field__label">班级（编号第 3 位）</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={9}
                  value={klass}
                  aria-label="班级"
                  onChange={(e) => setKlass(Number(e.target.value))}
                />
              </label>
            </div>
          )}

          <p className="field__hint" style={{ marginTop: 14 }}>
            编号会按这个规则发：{' '}
            <span className="t-num">
              {kind === 'crew' ? '1abcc' : `2${grade}${klass}xx`}
            </span>
            （后两位是顺序）
          </p>

          <div className="row gap-3" style={{ marginTop: 14 }}>
            <label className="grow">
              <span className="field__label">数量</span>
              <input
                className="input"
                type="number"
                min={1}
                max={50}
                value={count}
                aria-label="数量"
                onChange={(e) => setCount(Number(e.target.value))}
              />
            </label>
            <label className="grow">
              <span className="field__label">有效天数</span>
              <input
                className="input"
                type="number"
                min={1}
                max={365}
                value={days}
                aria-label="有效天数"
                onChange={(e) => setDays(Number(e.target.value))}
              />
            </label>
          </div>

          <label style={{ display: 'block', marginTop: 12 }}>
            <span className="field__label">备注（可选）</span>
            <input
              className="input"
              value={note}
              placeholder="给谁的，方便以后找"
              aria-label="备注"
              onChange={(e) => setNote(e.target.value)}
            />
          </label>

          <button
            type="button"
            className="btn btn--primary btn--block"
            style={{ marginTop: 16 }}
            disabled={busy}
            onClick={() => void generate()}
          >
            {busy ? '生成中…' : '生成认证密钥'}
          </button>
        </div>

        {fresh.length > 0 ? (
          <div className="card" style={{ marginTop: 12 }}>
            <p className="t-caption faint">刚生成的（只显示这一次）</p>
            <div
              style={{
                marginTop: 8,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 15,
                lineHeight: 1.9,
                letterSpacing: '0.4px',
                wordBreak: 'break-all',
              }}
            >
              {fresh.map((c) => (
                <div key={c}>{c}</div>
              ))}
            </div>
            <button type="button" className="btn btn--ghost btn--block" style={{ marginTop: 12 }} onClick={() => void copyAll()}>
              复制全部
            </button>
          </div>
        ) : null}

        <section className="section">
          <div className="between">
            <h2 className="section__title">全部密钥</h2>
            {bulk.selecting ? (
              <button type="button" className="linklike" onClick={bulk.exit}>
                取消
              </button>
            ) : (
              <button
                type="button"
                className="linklike"
                disabled={keys.length === 0}
                onClick={bulk.start}
              >
                选择
              </button>
            )}
          </div>
          <div style={{ marginTop: 10 }}>
            {loading ? (
              <p className="t-caption faint">加载中…</p>
            ) : keys.length === 0 ? (
              <p className="t-caption faint">还没有生成过。</p>
            ) : (
              keys.map((k) => {
                const used = !!k.usedAt
                const expired = k.expiresAt ? new Date(k.expiresAt) < new Date() : false
                return (
                  <div key={k.code} className="keyrow">
                    <div className="between">
                      <span className="row gap-2">
                        {bulk.selecting ? (
                          used ? (
                            <span className="pick pick--off" aria-hidden="true" />
                          ) : (
                            <Pick
                              checked={bulk.has(k.code)}
                              onChange={() => bulk.toggle(k.code)}
                              label={`选择 ${k.code}`}
                            />
                          )
                        ) : null}
                        <span className="keyrow__code">{k.code}</span>
                      </span>
                      <span
                        className="t-tag"
                        style={{
                          color: used || expired ? 'var(--text-3)' : 'var(--accent)',
                        }}
                      >
                        {used
                          ? `已用 · ${k.usedBy ?? ''}`
                          : expired
                            ? '已过期'
                            : k.specLabel}
                      </span>
                    </div>
                    <div className="between" style={{ marginTop: 2 }}>
                      <span className="t-tag faint">
                        {k.note || '无备注'} · {formatDate(k.createdAt.slice(0, 10))}
                      </span>
                      {!used && !expired ? (
                        <button type="button" className="linklike" onClick={() => void revoke(k.code)}>
                          作废
                        </button>
                      ) : null}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>
      </div>

      {bulk.selecting ? (
        <BulkBar
          count={bulk.count}
          onSelectAll={() =>
            bulk.toggleAll(
              keys
                .filter((k) => !k.usedAt && !(k.expiresAt && new Date(k.expiresAt) < new Date()))
                .map((k) => k.code),
            )
          }
          onCancel={bulk.exit}
          onDelete={() => void removeMany()}
          busy={bulkBusy}
        />
      ) : null}
    </>
  )
}

/* ============================================================
   评论审核
   ============================================================ */

interface AdminComment {
  id: string
  body: string
  status: string
  createdAt: string
  targetType: string
  targetId: string
  author: string
}

export function CommentsAdmin() {
  const { mode, toast } = useApp()
  const bulk = useBulk<string>()
  const askBulkDelete = useBulkDelete()
  const [bulkBusy, setBulkBusy] = useState(false)
  const [tab, setTab] = useState<'pending' | 'published' | 'hidden'>('pending')
  const [items, setItems] = useState<AdminComment[]>([])
  const [loading, setLoading] = useState(true)
  const [moderation, setModeration] = useState<'on' | 'off'>('on')

  const load = useCallback(async () => {
    if (mode !== 'online') {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [res, settings] = await Promise.all([
        api.admin.comments(tab),
        api.settings().catch(() => null),
      ])
      setItems(res.comments)
      if (settings) setModeration(settings.moderation === 'off' ? 'off' : 'on')
    } catch (err) {
      toast(err instanceof Error ? err.message : '加载失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [mode, tab, toast])

  useEffect(() => {
    void load()
  }, [load])

  if (mode !== 'online') {
    return (
      <>
        <NavBar
        title={bulk.selecting ? '选择评论' : '评论审核'}
        back
        action={
          bulk.selecting ? (
            <button type="button" className="nav__action" onClick={bulk.exit}>
              取消
            </button>
          ) : (
            <button
              type="button"
              className="nav__action"
              onClick={bulk.start}
              disabled={items.length === 0}
            >
              选择
            </button>
          )
        }
      />
        <EmptyState
          icon="info"
          title="现在是离线模式"
          desc="评论只有在线模式才有。启动 API 后再打开这一页。"
        />
      </>
    )
  }

  const act = async (id: string, status: 'published' | 'hidden') => {
    try {
      await api.admin.moderate(id, status)
      setItems((prev) => prev.filter((c) => c.id !== id))
      toast(status === 'published' ? '已通过' : '已隐藏')
    } catch (err) {
      toast(err instanceof Error ? err.message : '操作失败', 'error')
    }
  }

  const toggleModeration = async () => {
    const next = moderation === 'on' ? 'off' : 'on'
    try {
      await api.admin.setModeration(next)
      setModeration(next)
      toast(next === 'on' ? '已开启先审后发' : '已关闭审核，评论直接可见')
    } catch (err) {
      toast(err instanceof Error ? err.message : '设置失败', 'error')
    }
  }

  const removeMany = async () => {
    if (bulk.count === 0) return
    const ok = await askBulkDelete(bulk.count, '条评论')
    if (!ok) return
    setBulkBusy(true)
    try {
      const picked = [...bulk.list]
      for (const id of picked) await api.admin.moderate(id, 'delete')
      setItems((prev) => prev.filter((c) => !picked.includes(c.id)))
      toast(`已删除 ${picked.length} 条评论`)
      bulk.exit()
    } catch (err) {
      toast(err instanceof Error ? err.message : '删除失败', 'error')
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <>
      <NavBar
        title={bulk.selecting ? '选择评论' : '评论审核'}
        back
        action={
          bulk.selecting ? (
            <button type="button" className="nav__action" onClick={bulk.exit}>
              取消
            </button>
          ) : (
            <button
              type="button"
              className="nav__action"
              onClick={bulk.start}
              disabled={items.length === 0}
            >
              选择
            </button>
          )
        }
      />
      <div className="page__body">
        <div className="card" style={{ marginTop: 8, padding: 16 }}>
          <div className="between">
            <div>
              <p className="t-body">先审后发</p>
              <p className="t-caption faint" style={{ marginTop: 2 }}>
                {moderation === 'on' ? '评论要你通过后才公开' : '评论直接公开'}
              </p>
            </div>
            <button
              type="button"
              className="chip"
              aria-pressed={moderation === 'on'}
              onClick={() => void toggleModeration()}
            >
              {moderation === 'on' ? '已开启' : '已关闭'}
            </button>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <Segmented<'pending' | 'published' | 'hidden'>
            label="评论状态"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'pending', label: '待审核' },
              { value: 'published', label: '已发布' },
              { value: 'hidden', label: '已隐藏' },
            ]}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          {loading ? (
            <p className="t-caption faint">加载中…</p>
          ) : items.length === 0 ? (
            <EmptyState icon="info" title="这里没有评论" desc="换个分类看看。" />
          ) : (
            items.map((c) => (
              <div key={c.id} className="card" style={{ marginBottom: 10, padding: 16 }}>
                <div className="between">
                  <span className="row gap-2">
                    {bulk.selecting ? (
                      <Pick
                        checked={bulk.has(c.id)}
                        onChange={() => bulk.toggle(c.id)}
                        label={`选择 ${c.author} 的评论`}
                      />
                    ) : null}
                    <span className="comment__author">{c.author}</span>
                  </span>
                  <span className="t-tag faint">{formatDate(c.createdAt.slice(0, 10))}</span>
                </div>
                <p className="comment__body">{c.body}</p>
                <p className="t-tag faint" style={{ marginTop: 6 }}>
                  来自 {c.targetType === 'extra' ? '花絮' : '剧集'} · {c.targetId}
                </p>
                <div className="row gap-2" style={{ marginTop: 10 }}>
                  {c.status !== 'published' ? (
                    <button
                      type="button"
                      className="btn btn--primary"
                      style={{ minHeight: 40, padding: '0 18px' }}
                      onClick={() => void act(c.id, 'published')}
                    >
                      <Icon name="check" size={16} />
                      通过
                    </button>
                  ) : null}
                  {c.status !== 'hidden' ? (
                    <button
                      type="button"
                      className="btn btn--ghost"
                      style={{ minHeight: 40, padding: '0 18px' }}
                      onClick={() => void act(c.id, 'hidden')}
                    >
                      隐藏
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {bulk.selecting ? (
        <BulkBar
          count={bulk.count}
          onSelectAll={() => bulk.toggleAll(items.map((c) => c.id))}
          onCancel={bulk.exit}
          onDelete={() => void removeMany()}
          busy={bulkBusy}
        />
      ) : null}
    </>
  )
}

/* ============================================================
   账号管理
   ============================================================ */

interface AdminUser {
  id: string
  uid: string
  name: string
  avatar: string | null
  role: string
  verified: boolean
  label: string
  titles: string[]
  memberId: string | null
  perms: string[]
  badgeStyle: string | null
  avatarFrame: string | null
  plates: string[]
  titleExpires: Record<string, string>
  plateExpires: Record<string, string>
  avatarFrameUntil: string | null
  skinVipUntil: string | null
  skinSvipUntil: string | null
  sponsorUntil: string | null
  titleStyles: Record<string, string>
  keyCode: string | null
  createdAt: string
}

export function UsersPanel() {
  const { mode, toast, account } = useApp()
  const bulk = useBulk<string>()
  const askBulkDelete = useBulkDelete()
  const [bulkBusy, setBulkBusy] = useState(false)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<AdminUser | null>(null)

  const load = useCallback(async () => {
    if (mode !== 'online') {
      setLoading(false)
      return
    }
    try {
      const res = await api.admin.users()
      setUsers(Array.isArray(res.users) ? (res.users as AdminUser[]) : [])
    } catch (err) {
      toast(err instanceof Error ? err.message : '加载失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [mode, toast])

  useEffect(() => {
    void load()
  }, [load])

  if (mode !== 'online') {
    return (
      <EmptyState icon="users" title="现在是离线模式" desc="账号管理需要后端服务。" />
    )
  }

  const removeMany = async () => {
    if (bulk.count === 0) return
    const targets = users.filter((u) => bulk.selected.has(u.id))
    const blocked = targets.filter((u) => u.id === account?.id || u.role === 'superadmin')
    if (blocked.length > 0) {
      toast('自己或总管理员的账号不能删除，请取消选择', 'error')
      return
    }
    const ok = await askBulkDelete(bulk.count, '个账号')
    if (!ok) return
    setBulkBusy(true)
    try {
      let done = 0
      for (const u of targets) {
        await api.admin.deleteUser(u.id)
        done += 1
      }
      toast(`已删除 ${done} 个账号`)
      bulk.exit()
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : '删除失败', 'error')
      await load()
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <>
      <div className="page__body">
        <div className="between" style={{ marginTop: 8 }}>
          <p className="t-caption faint" style={{ marginRight: 12, lineHeight: 1.6 }}>
            所有注册过的账号。点开可以改昵称、编号、密码和认证状态。
          </p>
          {bulk.selecting ? (
            <button type="button" className="linklike" onClick={bulk.exit}>
              取消
            </button>
          ) : (
            <button
              type="button"
              className="linklike"
              onClick={bulk.start}
              disabled={users.length === 0}
            >
              选择
            </button>
          )}
        </div>

        {loading ? (
          <p className="t-caption faint" style={{ marginTop: 20 }}>
            加载中…
          </p>
        ) : users.length === 0 ? (
          <p className="t-caption faint" style={{ marginTop: 20 }}>
            还没有账号。
          </p>
        ) : (
          <div className="list" style={{ marginTop: 16 }}>
            {users.map((u) => (
              <div key={u.id} className="list__row">
                {bulk.selecting ? (
                  <Pick
                    checked={bulk.has(u.id)}
                    onChange={() => bulk.toggle(u.id)}
                    label={`选择 ${u.name}`}
                  />
                ) : null}
                <button
                  type="button"
                  className="grow row gap-2"
                  style={{ background: 'none', border: 0, textAlign: 'left' }}
                  onClick={() => (bulk.selecting ? bulk.toggle(u.id) : setEditing(u))}
                >
                <Avatar name={u.name} src={u.avatar} size={32} />
                <span className="grow" style={{ textAlign: 'left', minWidth: 0 }}>
                  <span className="list__title clamp-1" style={{ display: 'block' }}>
                    {u.name}
                  </span>
                  <span className="list__sub t-num">
                    {u.uid} · {u.label || (u.verified ? '认证访客' : '普通访客')}
                  </span>
                  {(u.titles ?? []).length > 0 ? (
                    <span className="t-tag" style={{ display: 'block', color: 'var(--accent)' }}>
                      {(u.titles ?? []).length} 个称号
                    </span>
                  ) : null}
                  {u.keyCode ? (
                    <span className="t-tag faint" style={{ display: 'block' }}>
                      密钥 {u.keyCode}
                    </span>
                  ) : null}
                </span>
                </button>
                <Icon name="chevron-right" size={18} />
              </div>
            ))}
          </div>
        )}
      </div>

      {bulk.selecting ? (
        <BulkBar
          count={bulk.count}
          onSelectAll={() => bulk.toggleAll(users.map((u) => u.id))}
          onCancel={bulk.exit}
          onDelete={() => void removeMany()}
          busy={bulkBusy}
        />
      ) : null}

      {editing ? (
        <UserForm
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            await load()
          }}
        />
      ) : null}
    </>
  )
}

/** ISO → yyyy-mm-dd */
function dayOf(iso: string): string {
  return iso ? iso.slice(0, 10) : ''
}

/** yyyy-mm-dd → 当天 23:59 的 ISO */
function endOfDay(day: string): string {
  return new Date(`${day}T23:59:00`).toISOString()
}

function UserForm({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUser
  onClose: () => void
  onSaved: () => void
}) {
  const { toast, account, content } = useApp()
  const members = content?.members ?? []
  const confirm = useConfirm()
  const [deleting, setDeleting] = useState(false)
  const isSelf = account?.id === user.id
  const canDelete = !isSelf && user.role !== 'superadmin'
  const [name, setName] = useState(user.name)
  const [uid, setUid] = useState(user.uid)
  const [memberId, setMemberId] = useState(user.memberId ?? '')
  const [permList, setPermList] = useState<string[]>(user.perms ?? [])
  const [badgeStyle, setBadgeStyle] = useState<string>(user.badgeStyle ?? 'auto')
  const [titleStyles, setTitleStyles] = useState<Record<string, string>>(user.titleStyles ?? {})
  const [sponsorDays, setSponsorDays] = useState('30')
  const [pointDelta, setPointDelta] = useState('100')
  const [frame, setFrame] = useState(user.avatarFrame ?? '')
  const [grantDays, setGrantDays] = useState(0)
  const [plateList, setPlateList] = useState<string[]>(user.plates ?? [])
  const [titleExp, setTitleExp] = useState<Record<string, string>>(user.titleExpires ?? {})
  const [plateExp, setPlateExp] = useState<Record<string, string>>(user.plateExpires ?? {})
  const [frameUntil, setFrameUntil] = useState(dayOf(user.avatarFrameUntil ?? ''))
  const [vipUntil, setVipUntil] = useState(dayOf(user.skinVipUntil ?? ''))
  const [svipUntil, setSvipUntil] = useState(dayOf(user.skinSvipUntil ?? ''))
  const [sponsorUntil, setSponsorUntil] = useState(dayOf(user.sponsorUntil ?? ''))
  const [roleDraft, setRoleDraft] = useState<'admin' | 'visitor'>(
    user.role === 'admin' ? 'admin' : 'visitor',
  )
  const isSuper = account?.role === 'superadmin'
  const targetIsAdmin = roleDraft === 'admin'
  const editableRole = isSuper && user.role !== 'superadmin'
  const [titleList, setTitleList] = useState<string[]>(user.titles ?? [])
  const [titleDraft, setTitleDraft] = useState('')
  const [password, setPassword] = useState('')
  const [verified, setVerified] = useState(user.verified)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    try {
      const patch: {
        name?: string
        password?: string
        verified?: boolean
        titles?: string[]
        memberId?: string | null
        perms?: string[]
        role?: 'visitor' | 'admin'
        badgeStyle?: string
        avatarFrame?: string | null
        avatarFrameDays?: number
        titleDays?: number
        plates?: string[]
        plateDays?: number
        titleExpires?: Record<string, string>
        plateExpires?: Record<string, string>
        avatarFrameUntil?: string | null
        skinVipUntil?: string | null
        skinSvipUntil?: string | null
        sponsorUntil?: string
        titleStyles?: Record<string, string>
      } = {}
      if (name.trim() && name.trim() !== user.name) patch.name = name.trim()
      if (password.trim()) patch.password = password.trim()
      if (verified !== user.verified) patch.verified = verified
      const sameTitles =
        titleList.length === (user.titles ?? []).length &&
        titleList.every((t, i) => t === (user.titles ?? [])[i])
      if (!sameTitles) patch.titles = titleList
      if (memberId !== (user.memberId ?? '')) patch.memberId = memberId || null
      if (badgeStyle !== (user.badgeStyle ?? 'auto')) patch.badgeStyle = badgeStyle
      patch.titleExpires = titleExp
      patch.plateExpires = plateExp
      if (dayOf(user.avatarFrameUntil ?? '') !== frameUntil) {
        patch.avatarFrameUntil = frameUntil ? endOfDay(frameUntil) : null
      }
      if (dayOf(user.skinVipUntil ?? '') !== vipUntil) {
        patch.skinVipUntil = vipUntil ? endOfDay(vipUntil) : null
      }
      if (dayOf(user.skinSvipUntil ?? '') !== svipUntil) {
        patch.skinSvipUntil = svipUntil ? endOfDay(svipUntil) : null
      }
      if (dayOf(user.sponsorUntil ?? '') !== sponsorUntil && sponsorUntil) {
        patch.sponsorUntil = endOfDay(sponsorUntil)
      }
      if (plateList.join() !== (user.plates ?? []).join()) {
        patch.plates = plateList
        patch.plateDays = grantDays
      }
      if (frame !== (user.avatarFrame ?? '')) {
        patch.avatarFrame = frame || null
        patch.avatarFrameDays = grantDays
      }
      if (patch.titles) patch.titleDays = grantDays
      if (JSON.stringify(titleStyles) !== JSON.stringify(user.titleStyles ?? {})) {
        patch.titleStyles = titleStyles
      }
      if (editableRole && roleDraft !== user.role) {
        patch.role = roleDraft === 'admin' ? 'admin' : 'visitor'
      }
      if (isSuper && roleDraft === 'admin' && permList.join() !== (user.perms ?? []).join()) {
        patch.perms = permList
      }

      if (uid.trim() && uid.trim() !== user.uid) {
        const numeric = Number(uid.trim())
        if (!Number.isInteger(numeric) || numeric < 1 || numeric > 99999) {
          throw new Error('编号要是 1–99999 的整数')
        }
        await api.admin.setUid(user.id, numeric)
      }

      if (Object.keys(patch).length > 0) await api.admin.updateUser(user.id, patch)
      toast(
        patch.titles !== undefined
          ? `已保存，称号 ${patch.titles.length} 个`
          : '已保存',
      )
      onSaved()
    } catch (err) {
      toast(err instanceof Error ? err.message : '保存失败', 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    const ok = await confirm({
      title: `删除「${user.name}」？`,
      message: '这个账号的评论和点赞会一起删除，无法恢复。',
      confirmText: '删除账号',
      danger: true,
    })
    if (!ok) return
    setDeleting(true)
    try {
      await api.admin.deleteUser(user.id)
      toast('账号已删除')
      onSaved()
    } catch (err) {
      toast(err instanceof Error ? err.message : '删除失败', 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Sheet
      open
      title="编辑账号"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void save()}>
            {busy ? '保存中…' : '保存'}
          </button>
        </>
      }
    >
      <p className="form-section">基本信息</p>

      <div className="field" style={{ marginTop: 0 }}>
        <label className="field__label" htmlFor="user-uid">
          数字编号
        </label>
        <input
          id="user-uid"
          className="input t-num"
          value={uid}
          onChange={(e) => setUid(e.target.value)}
          inputMode="numeric"
        />
        <p className="field__hint">
          可以强制改成任意编号（1–99999），不要求符合身份规则；称号可以单独定制。
        </p>
      </div>

      <p className="form-section">身份与权限</p>

      {editableRole ? (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <p className="t-caption faint">账号身份</p>
          <div className="chips" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="chip"
              aria-pressed={roleDraft !== 'admin'}
              onClick={() => setRoleDraft('visitor')}
            >
              普通账号
            </button>
            <button
              type="button"
              className="chip"
              aria-pressed={roleDraft === 'admin'}
              onClick={() => setRoleDraft('admin')}
            >
              管理员
            </button>
          </div>
        </div>
      ) : null}

      {isSuper && targetIsAdmin ? (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <p className="t-caption faint">这名管理员可以做什么</p>
          {PERM_GROUPS.map((group) => {
            const values = group.items.map(([v]) => v)
            const owned = expandPerms(permList)
            const allOn = values.every((v) => owned.has(v))
            return (
            <div key={group.title} style={{ marginTop: 12 }}>
              <div className="between" style={{ marginBottom: 6 }}>
                <span className="t-tag faint">{group.title}</span>
                <button
                  type="button"
                  className="linklike"
                  style={{ fontSize: 11 }}
                  onClick={() =>
                    setPermList((prev) =>
                      allOn
                        ? prev.filter((p) => !values.includes(p))
                        : Array.from(new Set([...prev, ...values])),
                    )
                  }
                >
                  {allOn ? '取消全选' : '全选'}
                </button>
              </div>
              <div className="chips">
                {group.items.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className="chip"
                    aria-pressed={expandPerms(permList).has(value)}
                    onClick={() =>
                      setPermList((prev) =>
                        prev.includes(value)
                          ? prev.filter((p) => p !== value)
                          : [...prev, value],
                      )
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            )
          })}
          <p className="field__hint">
            改完保存立刻生效，对方下次操作就会按新权限判断。
          </p>
        </div>
      ) : null}

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <p className="t-caption faint">身份铭牌（默认显示）</p>
        <div className="chips" style={{ marginTop: 8 }}>
          {BADGE_STYLES.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className="chip"
              aria-pressed={badgeStyle === opt.value}
              onClick={() => setBadgeStyle(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="field__hint">覆盖账号默认的身份铭牌；下方的「已拥有铭牌」是对方可自由搭配的铭牌。</p>
      </div>

      <p className="form-section">关联关系</p>

      <div className="field">
        <label className="field__label" htmlFor="user-member">
          绑定成员页
        </label>
        <select
          id="user-member"
          className="input"
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
        >
          <option value="">不绑定</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.roles.length ? ` · ${m.roles.join('/')}` : ''}
            </option>
          ))}
        </select>
        <p className="field__hint">
          绑定后，成员页里这个人点进去就是他的账号主页。
        </p>
      </div>

      <p className="form-section">称号与外观</p>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <p className="t-caption faint">发放时长</p>
        <div className="chips" style={{ marginTop: 8 }}>
          {[
            [0, '长期'],
            [7, '7 天'],
            [30, '30 天'],
            [90, '90 天'],
            [365, '365 天'],
          ].map(([days, label]) => (
            <button
              key={String(days)}
              type="button"
              className="chip"
              aria-pressed={grantDays === days}
              onClick={() => setGrantDays(days as number)}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="field__hint">对下方发放的称号、铭牌、头像框同时生效。</p>
      </div>


      <div className="field">
        <span className="field__label">称号（可以发多个）</span>
        <div className="row gap-2">
          <input
            id="user-title"
            className="input grow"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            placeholder="比如「特邀摄影」"
            maxLength={20}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              e.preventDefault()
              const value = titleDraft.trim()
              if (!value || titleList.includes(value)) return
              setTitleList((prev) => [...prev, value].slice(0, 10))
              if (badgeStyle !== 'auto') {
                setTitleStyles((prev) => ({ ...prev, [value]: badgeStyle }))
              }
              setTitleDraft('')
            }}
          />
          <button
            type="button"
            className="btn btn--ghost"
            style={{ minHeight: 44, padding: '0 16px' }}
            onClick={() => {
              const value = titleDraft.trim()
              if (!value || titleList.includes(value)) return
              setTitleList((prev) => [...prev, value].slice(0, 10))
              if (badgeStyle !== 'auto') {
                setTitleStyles((prev) => ({ ...prev, [value]: badgeStyle }))
              }
              setTitleDraft('')
            }}
          >
            添加
          </button>
        </div>
        {titleList.length > 0 ? (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {titleList.map((t) => (
              <div key={t} className="row gap-2" style={{ alignItems: 'center' }}>
                <span className="grow t-body">{t}</span>
                <input
                  className="input"
                  style={{ width: 132, minHeight: 34 }}
                  type="date"
                  aria-label={`${t} 的到期日`}
                  value={titleExp[t] ? titleExp[t].slice(0, 10) : ''}
                  onChange={(e) =>
                    setTitleExp((prev) => {
                      const next = { ...prev }
                      if (e.target.value) next[t] = endOfDay(e.target.value)
                      else delete next[t]
                      return next
                    })
                  }
                />
                <select
                  className="input"
                  style={{ width: 120, minHeight: 36 }}
                  aria-label={`${t} 的外观`}
                  value={titleStyles[t] ?? 'auto'}
                  onChange={(e) =>
                    setTitleStyles((prev) => {
                      const next = { ...prev }
                      if (e.target.value === 'auto') delete next[t]
                      else next[t] = e.target.value
                      return next
                    })
                  }
                >
                  {BADGE_STYLES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="linklike"
                  onClick={() => {
                    setTitleList((prev) => prev.filter((x) => x !== t))
                    setTitleStyles((prev) => {
                      const next = { ...prev }
                      delete next[t]
                      return next
                    })
                  }}
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <p className="field__hint">
          可以发多个，对方自己决定主页上展示哪几个（最多 3 个）。点称号可以删除。
        </p>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <p className="t-caption faint">已拥有铭牌（可多选）</p>
        <div className="perm-preview" style={{ marginTop: 8 }}>
          {BADGE_STYLES.filter((v) => v.value !== 'auto').map((opt) => (
            <button
              key={opt.value}
              type="button"
              className="perm-preview__item"
              aria-pressed={plateList.includes(opt.value)}
              onClick={() =>
                setPlateList((prev) =>
                  prev.includes(opt.value)
                    ? prev.filter((x) => x !== opt.value)
                    : [...prev, opt.value],
                )
              }
            >
              <Badge kind="member" style={opt.value} label={opt.label} />
            </button>
          ))}
        </div>
        {plateList.length > 0 ? (
          <div className="stack" style={{ marginTop: 10 }}>
            {plateList.map((pl) => (
              <div key={pl} className="between" style={{ gap: 8 }}>
                <span className="t-caption">{pl}</span>
                <input
                  className="input"
                  style={{ width: 132, minHeight: 34 }}
                  type="date"
                  aria-label={`${pl} 的到期日`}
                  value={plateExp[pl] ? plateExp[pl].slice(0, 10) : ''}
                  onChange={(e) =>
                    setPlateExp((prev) => {
                      const next = { ...prev }
                      if (e.target.value) next[pl] = endOfDay(e.target.value)
                      else delete next[pl]
                      return next
                    })
                  }
                />
              </div>
            ))}
          </div>
        ) : null}
        <p className="field__hint">勾选后保存，按上方发放时长生效；也可逐个改到期日。</p>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <p className="t-caption faint">头像框</p>
        <div className="chips" style={{ marginTop: 8 }}>
          {[
            ['', '无'],
            ['ring-gold', '金色'],
            ['ring-neon', '霓虹'],
            ['ring-silver', '银灰'],
          ].map(([v, l]) => (
            <button
              key={v || 'none'}
              type="button"
              className="chip"
              aria-pressed={frame === v}
              onClick={() => setFrame(v)}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="between" style={{ marginTop: 12 }}>
          <span className="t-caption faint">到期日</span>
          <input
            className="input"
            style={{ width: 150, minHeight: 34 }}
            type="date"
            aria-label="头像框到期日"
            value={frameUntil}
            onChange={(e) => setFrameUntil(e.target.value)}
          />
        </div>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <p className="t-caption faint">高级 / 顶级主页外观</p>
        <div className="between" style={{ marginTop: 10 }}>
          <span className="t-caption">高级外观到期日</span>
          <input
            className="input"
            style={{ width: 150, minHeight: 34 }}
            type="date"
            aria-label="高级外观到期日"
            value={vipUntil}
            onChange={(e) => setVipUntil(e.target.value)}
          />
        </div>
        <div className="between" style={{ marginTop: 8 }}>
          <span className="t-caption">顶级外观到期日</span>
          <input
            className="input"
            style={{ width: 150, minHeight: 34 }}
            type="date"
            aria-label="顶级外观到期日"
            value={svipUntil}
            onChange={(e) => setSvipUntil(e.target.value)}
          />
        </div>
        <p className="field__hint">留空表示长期有效；到期后对方就不能再选这套外观。</p>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <p className="t-caption faint">合作伙伴</p>
        <div className="between" style={{ marginTop: 8 }}>
          <span className="t-caption faint">到期日</span>
          <input
            className="input"
            style={{ width: 150, minHeight: 34 }}
            type="date"
            aria-label="合作到期日"
            value={sponsorUntil}
            onChange={(e) => setSponsorUntil(e.target.value)}
          />
        </div>
        <div className="row gap-2" style={{ marginTop: 10 }}>
          <input
            className="input"
            style={{ flex: 1 }}
            type="number"
            aria-label="合作天数"
            value={sponsorDays}
            onChange={(e) => setSponsorDays(e.target.value)}
          />
          <button
            type="button"
            className="btn btn--ghost"
            onClick={async () => {
              try {
                await api.adminSponsor(user.id, Number(sponsorDays) || 30)
                toast('已设为合作伙伴')
              } catch (err) {
                toast(err instanceof Error ? err.message : '发放失败', 'error')
              }
            }}
          >
            发放
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={async () => {
              try {
                await api.adminSponsor(user.id, 0, true)
                toast('已取消合作身份')
              } catch (err) {
                toast(err instanceof Error ? err.message : '取消失败', 'error')
              }
            }}
          >
            取消
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <p className="t-caption faint">发放积分</p>
        <div className="row gap-2" style={{ marginTop: 10 }}>
          <input
            className="input"
            style={{ flex: 1 }}
            type="number"
            aria-label="积分数量"
            value={pointDelta}
            onChange={(e) => setPointDelta(e.target.value)}
          />
          <button
            type="button"
            className="btn btn--ghost"
            onClick={async () => {
              try {
                await api.adminPoints(user.id, Number(pointDelta) || 0, false)
                toast('已发放积分')
              } catch (err) {
                toast(err instanceof Error ? err.message : '发放失败', 'error')
              }
            }}
          >
            普通积分
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={async () => {
              try {
                await api.adminPoints(user.id, Number(pointDelta) || 0, true)
                toast('已发放会员积分')
              } catch (err) {
                toast(err instanceof Error ? err.message : '发放失败', 'error')
              }
            }}
          >
            会员积分
          </button>
        </div>
      </div>

      <p className="form-section">昵称与安全</p>

      <div className="field">
        <label className="field__label" htmlFor="user-name">
          昵称
        </label>
        <input
          id="user-name"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="user-pwd">
          重置密码
        </label>
        <input
          id="user-pwd"
          className="input"
          type="text"
          value={password}
          placeholder="留空就不改，至少 6 位"
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="field__hint">改完请把新密码告诉本人，系统不会发通知。</p>
      </div>

      <label className="check" style={{ marginTop: 8 }}>
        <input
          type="checkbox"
          checked={verified}
          onChange={(e) => setVerified(e.target.checked)}
        />
        <span className="t-body">认证访客（可以评论、点赞）</span>
      </label>

      {canDelete ? (
        <button
          type="button"
          className="btn btn--ghost btn--block"
          style={{ marginTop: 20, color: 'var(--danger)' }}
          disabled={deleting}
          onClick={() => void remove()}
        >
          {deleting ? '删除中…' : '删除这个账号'}
        </button>
      ) : (
        <p className="field__hint" style={{ marginTop: 16 }}>
          {isSelf ? '不能删除自己的账号。' : '总管理员账号不能删除。'}
        </p>
      )}
    </Sheet>
  )
}


/* ============================================================
   账号与密钥（合并页）
   ============================================================ */

export function AccountsAdmin() {
  const [tab, setTab] = useState<'users' | 'keys'>('users')
  return (
    <>
      <NavBar title="账号与密钥" back />
      <div className="page__body">
        <Segmented<'users' | 'keys'>
          label="账号与密钥"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'users', label: '账号' },
            { value: 'keys', label: '密钥' },
          ]}
        />
      </div>
      {tab === 'users' ? <UsersPanel /> : <KeysPanel />}
    </>
  )
}
