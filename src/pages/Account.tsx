import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { NavBar } from '../components/ui'
import { useConfirm } from '../components/ui'
import { RequireAuth } from '../components/guards'
import { formatDate } from '../lib/format'
import { getGlassBlur, setGlassBlur } from '../lib/glass'

export function Settings() {
  return (
    <RequireAuth>
      <SettingsInner />
    </RequireAuth>
  )
}

function SettingsInner() {
  const { account, renameMe, changeMyPassword, signOut, toast } = useApp()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [name, setName] = useState(account?.name ?? '')
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [busy, setBusy] = useState(false)
  const [blur, setBlur] = useState(getGlassBlur())

  if (!account) return null

  const saveName = async () => {
    try {
      await renameMe(name)
      toast('昵称已更新')
    } catch (err) {
      toast(err instanceof Error ? err.message : '修改失败', 'error')
    }
  }

  const savePwd = async () => {
    if (newPwd !== confirmPwd) {
      toast('两次新密码不一样', 'error')
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
      toast(err instanceof Error ? err.message : '修改失败', 'error')
    } finally {
      setBusy(false)
    }
  }

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
        <section style={{ marginTop: 8 }}>
          <h2 className="t-caption faint" style={{ fontWeight: 600, marginBottom: 8 }}>
            昵称
          </h2>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          <button
            type="button"
            className="btn btn--ghost btn--block"
            style={{ marginTop: 12 }}
            onClick={() => void saveName()}
          >
            保存昵称
          </button>
        </section>

        <section className="section">
          <h2 className="t-caption faint" style={{ fontWeight: 600, marginBottom: 8 }}>
            修改密码
          </h2>
          <div className="field" style={{ marginTop: 0 }}>
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
          <button
            type="button"
            className="btn btn--primary btn--block"
            style={{ marginTop: 16 }}
            disabled={busy}
            onClick={() => void savePwd()}
          >
            {busy ? '更新中…' : '更新密码'}
          </button>
        </section>

        <section className="section">
          <h2 className="t-caption faint" style={{ fontWeight: 600, marginBottom: 8 }}>
            外观
          </h2>
          <div className="card" style={{ padding: 18 }}>
            <div className="between">
              <span className="t-body">毛玻璃模糊度</span>
              <span className="count">{blur}px</span>
            </div>
            <input
              className="range"
              type="range"
              min={0}
              max={40}
              step={2}
              value={blur}
              aria-label="毛玻璃模糊度"
              onChange={(e) => setBlur(setGlassBlur(Number(e.target.value)))}
            />
            <div className="glass-preview" aria-hidden="true">
              拖动试试，导航栏和卡片会一起变
            </div>
            <p className="field__hint" style={{ marginTop: 10 }}>
              手机性能一般时调低一点会更顺。深色模式跟随系统。
            </p>
          </div>
        </section>

        <div className="list" style={{ marginTop: 32 }}>
          <button type="button" className="list__row list__danger" onClick={() => void onSignOut()}>
            退出登录
          </button>
        </div>
      </div>
    </>
  )
}

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
