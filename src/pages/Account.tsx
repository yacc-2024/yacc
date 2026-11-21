import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { NavBar, Avatar, ListRow, Segmented, useConfirm } from '../components/ui'
import { RequireAuth } from '../components/guards'
import { formatDate } from '../lib/format'
import { formatUid, displayTitles } from '../lib/uid'
import { latestChangelog, sortedChangelog } from '../lib/selectors'
import { useRef } from 'react'
import { AvatarCropper } from '../components/AvatarCropper'
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
            <p className="t-caption faint t-num" style={{ marginTop: 2 }}>
              ID {formatUid(account.uid)}
            </p>
            <span className="title-row">
              {displayTitles(
                account.uid,
                account.role,
                account.verified,
                account.titles,
                account.shownTitles,
              ).map((t) => (
                <span key={t} className="title-chip">
                  {t}
                </span>
              ))}
            </span>
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
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [shown, setShown] = useState<string[]>(account?.shownTitles ?? [])
  const fileRef = useRef<HTMLInputElement | null>(null)

  if (!account) return null

  const dirty = name.trim() !== account.name || avatar.trim() !== (account.avatar ?? '')

  const save = async () => {
    setBusy(true)
    try {
      const shownChanged =
        shown.length > 0 &&
        (shown.length !== (account.shownTitles ?? []).length ||
          shown.some((t) => !(account.shownTitles ?? []).includes(t)))

      await updateProfile({
        name: name.trim(),
        avatar: avatar.trim() ? avatar.trim() : null,
        ...(shownChanged ? { shownTitles: shown } : {}),
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
        <div className="avatar-card">
          <Avatar name={name || account.name} src={avatar || null} size={88} />
          <div className="avatar-card__actions">
            <button
              type="button"
              className="btn btn--ghost"
              style={{ minHeight: 40, padding: '0 18px' }}
              disabled={mode === 'local'}
              onClick={() => fileRef.current?.click()}
            >
              {avatar ? '换一张' : '上传头像'}
            </button>
            {avatar ? (
              <button
                type="button"
                className="btn btn--ghost"
                style={{ minHeight: 40, padding: '0 18px' }}
                onClick={() => setAvatar('')}
              >
                移除
              </button>
            ) : null}
          </div>
          <p className="t-caption faint" style={{ marginTop: 10 }}>
            {mode === 'local' ? '离线模式暂时不能上传头像。' : '上传后可以拖动调整位置'}
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            aria-label="选择头像图片"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) setCropFile(file)
              e.target.value = ''
            }}
          />
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="between">
            <div>
              <p className="t-caption faint">数字账号 ID</p>
              <p className="t-title3 t-num" style={{ marginTop: 2 }}>
                {formatUid(account.uid)}
              </p>
            </div>
            {account.uid ? (
              <button type="button" className="chip" onClick={() => void copyUid()}>
                复制
              </button>
            ) : null}
          </div>

        </div>

        {account.titles && account.titles.length > 0 ? (
          <div className="card" style={{ marginTop: 16 }}>
            <p className="t-caption faint">展示哪个称号（最多 3 个）</p>
            <div className="chips" style={{ marginTop: 10 }}>
              {account.titles.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="chip"
                  aria-pressed={shown.includes(t)}
                  onClick={() =>
                    setShown((prev) =>
                      prev.includes(t)
                        ? prev.filter((x) => x !== t)
                        : prev.length >= 3
                          ? prev
                          : [...prev, t],
                    )
                  }
                >
                  {t}
                </button>
              ))}
            </div>
            <p className="field__hint" style={{ marginTop: 8 }}>
              这些是管理员发给你的称号，可以自己决定主页上显示哪几个。
            </p>
          </div>
        ) : null}

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
            或者填图片地址
          </label>
          <input
            id="avatar"
            className="input"
            value={avatar.startsWith('data:') ? '' : avatar}
            onChange={(e) => setAvatar(e.target.value)}
            placeholder="https://…（不想上传时用）"
            disabled={mode === 'local'}
          />
          <p className="field__hint">
            {avatar.startsWith('data:')
              ? '当前用的是上传的图片，在上面点「移除」可以恢复首字母。'
              : '留空就显示姓氏首字母。'}
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

        {cropFile ? (
          <AvatarCropper
            file={cropFile}
            onCancel={() => setCropFile(null)}
            onConfirm={(data) => {
              setAvatar(data)
              setCropFile(null)
            }}
          />
        ) : null}
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
    const label =
      value === 'smooth' ? '丝滑' : value === 'performance' ? '性能优先' : '均衡'
    toast(`动效已切换为${label}`)
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
              { value: 'smooth', label: '丝滑' },
              { value: 'balanced', label: '均衡' },
              { value: 'performance', label: '性能' },
            ]}
          />
          <p className="field__hint" style={{ marginTop: 8 }}>
            丝滑：过渡更慢更柔和；均衡：默认手感；性能：几乎不动画，老手机更顺。
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
  const latest = latestChangelog(c.changelog)
  const list = sortedChangelog(c.changelog)

  return (
    <>
      <NavBar title="版本与更新日志" back />
      <div className="page__body">
        <div style={{ marginTop: 8, textAlign: 'center' }}>
          <p style={{ fontSize: 30, fontWeight: 700, letterSpacing: -1.2 }}>yacc</p>
          <p className="t-caption" style={{ marginTop: 4 }}>
            当前版本 {latest?.version ? `v${latest.version}` : '—'}
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
