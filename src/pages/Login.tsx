import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../state/AppContext'

type Mode = 'login' | 'register' | 'admin'

export function Login() {
  const { signIn, signUp, createAdmin, toast, toggleFavorite, secureCrypto } = useApp()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const initial = params.get('mode')
  const [mode, setMode] = useState<Mode>(
    initial === 'register' ? 'register' : initial === 'admin' ? 'admin' : 'login',
  )
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [invite, setInvite] = useState('')
  const [adminCode, setAdminCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const secure = secureCrypto

  const state = (location.state ?? {}) as {
    from?: string
    favorite?: { type: 'episode' | 'extra'; id: string }
  }

  const subtitle = useMemo(() => {
    if (mode === 'admin') return '输入负责人给你的激活码，把这台设备设为管理端。'
    if (mode === 'register') return '输入邀请码，加入 YACC 创作组。'
    return '用你的账号登录。'
  }, [mode])

  const finish = async () => {
    if (state.favorite) {
      await toggleFavorite(state.favorite.type, state.favorite.id)
      toast('已收藏')
    }
    navigate(state.from ?? '/', { replace: true })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'admin') {
        if (password !== confirm) throw new Error('两次密码不一样')
        const keys = await createAdmin(name, password, adminCode.trim())
        toast(keys.length ? `管理员已就绪，生成 ${keys.length} 个初始密钥` : '管理员已就绪')
      } else if (mode === 'register') {
        if (password !== confirm) throw new Error('两次密码不一样')
        await signUp(invite, name, password)
        toast('欢迎加入')
      } else {
        await signIn(name, password)
      }
      await finish()
    } catch (err) {
      const message = err instanceof Error ? err.message : '出错了，再试一次'
      if (mode === 'admin' && message.includes('已经存在管理员')) {
        setMode('login')
        setName(name)
        setPassword('')
        setError('管理员已经建好了，请用账号密码登录')
        return
      }
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
  }

  const submitLabel =
    mode === 'admin' ? '激活管理端' : mode === 'register' ? '加入剧组' : '登录'

  return (
    <div className="auth">
      <Link to="/" className="auth__brand">
        yacc
      </Link>
      <p className="auth__sub">{subtitle}</p>

      {mode !== 'admin' ? (
        <div className="seg" style={{ marginTop: 22 }} role="tablist" aria-label="切换模式">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className="seg__item"
            onClick={() => switchMode('login')}
          >
            登录
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            className="seg__item"
            onClick={() => switchMode('register')}
          >
            注册
          </button>
        </div>
      ) : (
        <>
          <p
            className="t-caption"
            style={{ marginTop: 22, color: 'var(--accent)', fontWeight: 600 }}
          >
            管理员激活
          </p>
          <p className="t-caption faint" style={{ marginTop: 6, lineHeight: 1.6 }}>
            这一页只用于第一次激活。如果管理员已经建好了，
            <button
              type="button"
              className="linklike"
              style={{ marginLeft: 4 }}
              onClick={() => switchMode('login')}
            >
              直接用账号密码登录
            </button>
          </p>
        </>
      )}

      <form className="auth__form" onSubmit={(e) => void submit(e)}>
        {mode === 'admin' ? (
          <div className="field" style={{ marginTop: 0 }}>
            <label className="field__label" htmlFor="admin-code">
              激活码
            </label>
            <input
              id="admin-code"
              className="input"
              value={adminCode}
              onChange={(e) => setAdminCode(e.target.value)}
              autoComplete="off"
              placeholder="负责人提供"
            />
          </div>
        ) : null}

        {mode === 'register' ? (
          <div className="field" style={{ marginTop: 0 }}>
            <label className="field__label" htmlFor="invite">
              邀请码
            </label>
            <input
              id="invite"
              className="input"
              value={invite}
              onChange={(e) => setInvite(e.target.value)}
              autoComplete="off"
              placeholder="向负责人要"
            />
          </div>
        ) : null}

        <div className="field">
          <label className="field__label" htmlFor="name">
            昵称
          </label>
          <input
            id="name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="username"
            placeholder="2–12 个字符"
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="password">
            密码
          </label>
          <input
            id="password"
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder="至少 6 位"
          />
        </div>

        {mode !== 'login' ? (
          <div className="field">
            <label className="field__label" htmlFor="confirm">
              确认密码
            </label>
            <input
              id="confirm"
              className="input"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        ) : null}

        {error ? <p className="error-line">{error}</p> : null}

        <button
          type="submit"
          className="btn btn--primary btn--block"
          style={{ marginTop: 20 }}
          disabled={busy}
        >
          {busy ? '处理中…' : submitLabel}
        </button>
      </form>

      {mode === 'admin' ? (
        <p className="auth__switch">
          <button type="button" onClick={() => switchMode('login')}>
            返回登录
          </button>
        </p>
      ) : null}

      {!secure ? (
        <p className="t-tag faint" style={{ marginTop: 14, lineHeight: 1.7 }}>
          当前是用 http 打开的：浏览器在这种地址下禁用了安全哈希，
          已自动切换为兼容计算（登录会慢半秒）。换到 https 打开会自动恢复。
        </p>
      ) : null}

      <p className="auth__foot">
        忘记密码请找负责人重置。
        {mode !== 'admin' ? (
          <>
            <br />
            <button
              type="button"
              className="linklike"
              style={{ marginTop: 8 }}
              onClick={() => switchMode('admin')}
            >
              我是负责人
            </button>
          </>
        ) : null}
      </p>
    </div>
  )
}
