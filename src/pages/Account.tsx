import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { NavBar, Avatar, ListRow, Segmented, useConfirm } from '../components/ui'
import { RequireAuth } from '../components/guards'
import { formatDate } from '../lib/format'
import {
  DEFAULT_BLUR,
  MAX_BLUR,
  getGlassBlur,
  setGlassBlur,
} from '../lib/glass'
import {
  getFontScale,
  getMotionMode,
  getThemeMode,
  setFontScale,
  setMotionMode,
  setThemeMode,
  type FontScale,
  type MotionMode,
  type ThemeMode,
} from '../lib/appearance'

/* ============================================================
   账号设置（入口页）
   ============================================================ */

export function Settings() {
  return (
    <RequireAuth>
      <SettingsHome />
    </RequireAuth>
  )
}

function SettingsHome() {
  const { account, signOut, toast, mode } = useApp()
  const confirm = useConfirm()
  const navigate = useNavigate()

  if (!account) return null

  const onSignOut = async () => {
    const ok = await confirm({
      title: '退出登录？',
      message: '收藏和观看历史会留在这台设备上。',
      confirmText: '退出',
    })
    if (!ok) return
    await signOut()
    navigate('/me', { replace: true })
    toast('已退出')
  }

  return (
    <>
      <NavBar title="账号设置" back />
      <div className="page__body">
        <div className="profile-head">
          <Avatar name={account.name} src={account.avatar} size={56} />
          <div className="grow">
            <p className="t-title3">{account.name}</p>
            <p className="t-caption faint t-num">
              {account.uid ? `ID ${account.uid}` : '本地账号'} ·{' '}
              {account.role === 'admin' ? '管理员' : account.role === 'member' ? '船员' : '认证访客'}
            </p>
          </div>
        </div>

        <div className="list">
          <ListRow icon="person" title="个人资料" sub="头像、昵称" to="/me/settings/profile" />
          <ListRow icon="lock" title="修改密码" sub="旧密码 + 新密码" to="/me/settings/password" />
          <ListRow
            icon="gear"
            title="外观"
            sub="深浅色、毛玻璃、动效、字号"
            to="/me/settings/appearance"
          />
        </div>

        {mode === 'local' ? (
          <p className="t-caption faint" style={{ marginTop: 14, lineHeight: 1.6 }}>
            当前是离线模式：资料只存在这台设备上，头像等在线功能不可用。
          </p>
        ) : null}

        <div className="list" style={{ marginTop: 24 }}>
          <button type="button" className="list__row list__danger" onClick={() => void onSignOut()}>
            退出登录
          </button>
        </div>
      </div>
    </>
  )
}

/* ============================================================
   个人资料
   ============================================================ */

export function ProfileSettings() {
  return (
    <RequireAuth>
      <ProfileSettingsInner />
    </RequireAuth>
  )
}

function ProfileSettingsInner() {
  const { account, updateProfile, toast, mode } = useApp()
  const [name, setName] = useState(account?.name ?? '')
  const [avatar, setAvatar] = useState(account?.avatar ?? '')
  const [busy, setBusy] = useState(false)

  if (!account) return null

  const dirty = name.trim() !== account.name || avatar.trim() !== (account.avatar ?? '')

  const save = async () => {
    setBusy(true)
    try {
      await updateProfile({
        name: name.trim(),
        avatar: avatar.trim() ? avatar.trim() : null,
      })
      toast('已保存')
    } catch (err) {
      toast(err instanceof Error ? err.message : '保存失败', 'error')
    } finally {
      setBusy(false)
    }
  }

  const copyUid = async () => {
    if (!account.uid) return
    try {
      await navigator.clipboard.writeText(String(account.uid))
      toast('账号 ID 已复制')
    } catch {
      toast('复制失败', 'error')
    }
  }

  return (
    <>
      <NavBar title="个人资料" back />
      <div className="page__body">
        <div style={{ textAlign: 'center', paddingTop: 12 }}>
          <Avatar name={account.name} src={account.avatar} size={88} />
          <p className="t-caption faint" style={{ marginTop: 8 }}>
            {account.avatar ? '当前头像' : '还没设置头像'}
          </p>
        </div>

        <div className="card" style={{ marginTop: 20 }}>
          <div className="between">
            <div>
              <p className="t-caption faint">数字账号 ID</p>
              <p className="t-title3 t-num" style={{ marginTop: 2 }}>
                {account.uid ?? '—'}
              </p>
            </div>
            {account.uid ? (
              <button type="button" className="chip" onClick={() => void copyUid()}>
                复制
              </button>
            ) : null}
          </div>
          <p className="field__hint" style={{ marginTop: 10 }}>
            这个号码注册后就不会变了，像学号一样。昵称可以改，ID 不行。
          </p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="nickname">
            昵称
          </label>
          <input
            id="nickname"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="2–12 个字符"
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="avatar">
            头像图片地址
          </label>
          <input
            id="avatar"
            className="input"
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
            placeholder="https://…"
            disabled={mode === 'local'}
          />
          <p className="field__hint">
            {mode === 'local'
              ? '离线模式暂时不能设置头像。'
              : '填一个图片链接（http 开头）。留空就恢复成姓氏首字母。'}
          </p>
        </div>

        <button
          type="button"
          className="btn btn--primary btn--block"
          style={{ marginTop: 20 }}
          disabled={busy || !dirty}
          onClick={() => void save()}
        >
          {busy ? '保存中…' : dirty ? '保存' : '已保存'}
        </button>
      </div>
    </>
  )
}

/* ============================================================
   修改密码
   ============================================================ */

export function PasswordSettings() {
  return (
    <RequireAuth>
      <PasswordSettingsInner />
    </RequireAuth>
  )
}

function PasswordSettingsInner() {
  const { changeMyPassword, toast } = useApp()
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setError(null)
    if (newPwd.length < 6) {
      setError('新密码至少 6 位')
      return
    }
    if (newPwd !== confirmPwd) {
      setError('两次新密码不一样')
      return
    }
    setBusy(true)
    try {
      await changeMyPassword(oldPwd, newPwd)
      setOldPwd('')
      setNewPwd('')
      setConfirmPwd('')
      toast('密码已更新')
    } catch (err) {
      setError(err instanceof Error ? err.message : '修改失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <NavBar title="修改密码" back />
      <div className="page__body">
        <div className="field" style={{ marginTop: 8 }}>
          <label className="field__label" htmlFor="old">
            旧密码
          </label>
          <input
            id="old"
            className="input"
            type="password"
            value={oldPwd}
            onChange={(e) => setOldPwd(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="new">
            新密码
          </label>
          <input
            id="new"
            className="input"
            type="password"
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            autoComplete="new-password"
            placeholder="至少 6 位"
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="new2">
            再输一次新密码
          </label>
          <input
            id="new2"
            className="input"
            type="password"
            value={confirmPwd}
            onChange={(e) => setConfirmPwd(e.target.value)}
            autoComplete="new-password"
          />
        </div>

        {error ? <p className="error-line">{error}</p> : null}

        <button
          type="button"
          className="btn btn--primary btn--block"
          style={{ marginTop: 24 }}
          disabled={busy}
          onClick={() => void save()}
        >
          {busy ? '更新中…' : '更新密码'}
        </button>
        <p className="field__hint" style={{ marginTop: 12, textAlign: 'center' }}>
          更新后旧密码立即失效，当前设备保持登录。
        </p>
      </div>
    </>
  )
}

/* ============================================================
   外观
   ============================================================ */

export function AppearanceSettings() {
  const { toast } = useApp()
  const [theme, setTheme] = useState<ThemeMode>(getThemeMode())
  const [motion, setMotion] = useState<MotionMode>(getMotionMode())
  const [font, setFont] = useState<FontScale>(getFontScale())
  const [blur, setBlur] = useState(getGlassBlur())

  const onTheme = (value: ThemeMode) => {
    setTheme(value)
    setThemeMode(value)
  }
  const onMotion = (value: MotionMode) => {
    setMotion(value)
    setMotionMode(value)
    toast(value === 'reduced' ? '已减弱动效' : '已恢复完整动效')
  }
  const onFont = (value: FontScale) => {
    setFont(value)
    setFontScale(value)
  }

  return (
    <>
      <NavBar title="外观" back />
      <div className="page__body">
        <section style={{ marginTop: 8 }}>
          <h2 className="field__label">深浅色</h2>
          <Segmented<ThemeMode>
            label="深浅色模式"
            value={theme}
            onChange={onTheme}
            options={[
              { value: 'system', label: '跟随系统' },
              { value: 'light', label: '浅色' },
              { value: 'dark', label: '深色' },
            ]}
          />
        </section>

        <section className="section">
          <div className="between" style={{ marginBottom: 8 }}>
            <h2 className="field__label" style={{ margin: 0 }}>
              毛玻璃模糊度
            </h2>
            <span className="count">{blur}px</span>
          </div>
          <input
            className="range"
            type="range"
            min={0}
            max={MAX_BLUR}
            step={2}
            value={blur}
            aria-label="毛玻璃模糊度"
            onChange={(e) => setBlur(setGlassBlur(Number(e.target.value)))}
          />
          <div className="glass-preview" aria-hidden="true">
            拖动试试，导航栏和卡片会一起变
          </div>
          <p className="field__hint" style={{ marginTop: 8 }}>
            手机性能一般时调低一点会更顺。默认 {DEFAULT_BLUR}px。
          </p>
        </section>

        <section className="section">
          <h2 className="field__label">动效</h2>
          <Segmented<MotionMode>
            label="动效强度"
            value={motion}
            onChange={onMotion}
            options={[
              { value: 'full', label: '标准' },
              { value: 'reduced', label: '减弱' },
            ]}
          />
          <p className="field__hint" style={{ marginTop: 8 }}>
            减弱后页面切换和按压反馈会变快，适合觉得动画拖沓或头晕的时候。
          </p>
        </section>

        <section className="section">
          <h2 className="field__label">字号</h2>
          <Segmented<string>
            label="字号大小"
            value={String(font)}
            onChange={(v) => onFont(Number(v) as FontScale)}
            options={[
              { value: '100', label: '标准' },
              { value: '112', label: '大' },
              { value: '125', label: '更大' },
            ]}
          />
          <div className="card" style={{ marginTop: 12, padding: 16 }}>
            <p className="t-body">这一行是正文，用来预览字号。</p>
            <p className="t-caption" style={{ marginTop: 4 }}>
              这是辅助说明文字。
            </p>
          </div>
        </section>
      </div>
    </>
  )
}

/* ============================================================
   版本与更新日志
   ============================================================ */

export function Version() {
  const { content } = useApp()
  const c = content!
  const list = [...c.changelog].reverse()

  return (
    <>
      <NavBar title="版本与更新日志" back />
      <div className="page__body">
        <div style={{ marginTop: 8, textAlign: 'center' }}>
          <p style={{ fontSize: 30, fontWeight: 700, letterSpacing: -1.2 }}>yacc</p>
          <p className="t-caption" style={{ marginTop: 4 }}>
            当前版本 {c.changelog[0]?.version ?? '—'}
          </p>
        </div>

        <div className="list" style={{ marginTop: 24 }}>
          {list.map((cl) => (
            <div key={cl.version} className="list__row list__row--plain" style={{ display: 'block', paddingBlock: 14 }}>
              <p className="t-title3">
                {cl.version}
                <span className="t-caption faint" style={{ marginLeft: 8 }}>
                  {formatDate(cl.date)}
                </span>
              </p>
              <ul style={{ marginTop: 6 }}>
                {cl.items.map((it, i) => (
                  <li key={i} className="t-caption" style={{ lineHeight: 1.7 }}>
                    · {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="t-tag faint" style={{ marginTop: 24, textAlign: 'center' }}>
          数据保存在这台设备上。
        </p>
      </div>
    </>
  )
}
