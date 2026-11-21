import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../../state/AppContext'
import { NavBar, Segmented, EmptyState, useConfirm, Avatar, Sheet } from '../../components/ui'
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

const PERM_LABELS: Array<[AdminPerm, string]> = [
  ['content', '内容编辑'],
  ['users', '账号管理'],
  ['keys', '密钥发放'],
  ['comments', '评论审核'],
]

export function KeysPanel() {
  const { mode, toast, account } = useApp()
  const isSuper = account?.role === 'superadmin'
  const confirm = useConfirm()
  const [keys, setKeys] = useState<KeyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [kind, setKind] = useState<'crew' | 'member' | 'admin'>('member')
  const [perms, setPerms] = useState<AdminPerm[]>(['content'])
  const [crewRole, setCrewRole] = useState(1)
  const [crewSeason, setCrewSeason] = useState(1)
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
      setKeys(res.keys)
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
      const spec =
        kind === 'admin'
          ? { kind: 'admin' as const, perms }
          : kind === 'crew'
            ? { kind: 'crew' as const, role: crewRole, season: crewSeason }
            : { kind: 'member' as const, grade, klass }
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
              <div className="chips">
                {PERM_LABELS.map(([value, label]) => (
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
            </>
          ) : kind === 'crew' ? (
            <>
              <p className="field__label" style={{ marginTop: 16 }}>
                剧组身份（编号第 2 位）
              </p>
              <div className="chips">
                {[
                  [1, '导演'],
                  [2, '编剧'],
                  [3, '剪辑'],
                  [4, '摄影'],
                  [5, '演员'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className="chip"
                    aria-pressed={crewRole === value}
                    onClick={() => setCrewRole(value as number)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <p className="field__label" style={{ marginTop: 14 }}>
                参与季（编号第 3 位）
              </p>
              <div className="chips">
                {[
                  [1, '第一季'],
                  [2, '第二季'],
                  [9, '两季都参与'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className="chip"
                    aria-pressed={crewSeason === value}
                    onClick={() => setCrewSeason(value as number)}
                  >
                    {label}
                  </button>
                ))}
              </div>
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
              {kind === 'crew'
                ? `1${crewRole}${crewSeason}xx`
                : `2${grade}${klass}xx`}
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
          <h2 className="section__title">全部密钥</h2>
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
                      <span className="keyrow__code">{k.code}</span>
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
        <NavBar title="评论审核" back />
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

  return (
    <>
      <NavBar title="评论审核" back />
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
                  <span className="comment__author">{c.author}</span>
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
  keyCode: string | null
  createdAt: string
}

export function UsersPanel() {
  const { mode, toast } = useApp()
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
      setUsers(res.users as AdminUser[])
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

  return (
    <>
      <div className="page__body">
        <p className="t-caption faint" style={{ marginTop: 8, lineHeight: 1.6 }}>
          所有注册过的账号。点开可以改昵称、编号、密码和认证状态。
        </p>

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
              <button
                key={u.id}
                type="button"
                className="list__row"
                onClick={() => setEditing(u)}
              >
                <Avatar name={u.name} src={u.avatar} size={32} />
                <span className="grow" style={{ textAlign: 'left', minWidth: 0 }}>
                  <span className="list__title clamp-1" style={{ display: 'block' }}>
                    {u.name}
                  </span>
                  <span className="list__sub t-num">
                    {u.uid} · {u.label || (u.verified ? '认证访客' : '普通访客')}
                  </span>
                  {u.keyCode ? (
                    <span className="t-tag faint" style={{ display: 'block' }}>
                      密钥 {u.keyCode}
                    </span>
                  ) : null}
                </span>
                <Icon name="chevron-right" size={18} />
              </button>
            ))}
          </div>
        )}
      </div>

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

function UserForm({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUser
  onClose: () => void
  onSaved: () => void
}) {
  const { toast, account } = useApp()
  const confirm = useConfirm()
  const [deleting, setDeleting] = useState(false)
  const isSelf = account?.id === user.id
  const canDelete = !isSelf && user.role !== 'superadmin'
  const [name, setName] = useState(user.name)
  const [uid, setUid] = useState(user.uid)
  const [password, setPassword] = useState('')
  const [verified, setVerified] = useState(user.verified)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    try {
      const patch: { name?: string; password?: string; verified?: boolean } = {}
      if (name.trim() && name.trim() !== user.name) patch.name = name.trim()
      if (password.trim()) patch.password = password.trim()
      if (verified !== user.verified) patch.verified = verified

      if (uid.trim() && uid.trim() !== user.uid) {
        const numeric = Number(uid.trim())
        if (!Number.isInteger(numeric) || numeric < 1 || numeric > 99999) {
          throw new Error('编号要是 1–99999 的整数')
        }
        await api.admin.setUid(user.id, numeric)
      }

      if (Object.keys(patch).length > 0) await api.admin.updateUser(user.id, patch)
      toast('已保存')
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
        <p className="field__hint">五位编号，改动会影响身份称号。</p>
      </div>

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
