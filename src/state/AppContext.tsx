import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Content, FavRef, HistoryRef } from '../data/schema'
import {
  loadContent,
  normaliseContent,
  resolveContent,
  useDraftContent,
  type LoadResult,
} from '../data/store'
import { clearDraft, loadDraft, makeDraft, saveDraft } from '../data/draft'
import { storageGet, storageSet } from '../data/storage'
import {
  AuthError,
  changePassword as localChangePassword,
  clearSession as localClearSession,
  loadSessionAccount,
  login as localLogin,
  register as localRegister,
  renameAccount as localRename,
  setSession as localSetSession,
} from '../data/accounts'
import { listFavorites, toggleFavorite as toggleFavStorage } from '../data/favorites'
import { listHistory, recordHistory } from '../data/history'
import { commitPendingRestore } from '../data/restore'
import { usePolling } from '../hooks/usePolling'
import {
  api,
  cacheUser,
  clearCachedUser,
  getToken,
  isAuthError,
  readCachedUser,
  setToken,
  setUnauthorizedHandler,
} from '../lib/api'
import { isSecureCryptoAvailable } from '../data/accounts'

const CONTENT_CACHE_KEY = 'yacc:content-cache'

export type AppMode = 'checking' | 'online' | 'local'

export interface SessionUser {
  id: string
  uid?: number | null
  name: string
  avatar?: string | null
  titles?: string[]
  shownTitles?: string[]
  role: 'superadmin' | 'admin' | 'member' | 'visitor'
  verified: boolean
  perms?: string[]
}

export interface ToastItem {
  id: number
  message: string
  type: 'ok' | 'error'
}

interface AppContextValue {
  content: Content | null
  loading: boolean
  error: string | null
  mode: AppMode
  source: LoadResult['source']
  conflict: boolean
  dirty: boolean
  externalChange: boolean
  kicked: boolean
  dismissKicked: () => void
  online: boolean
  account: SessionUser | null
  favorites: FavRef[]
  history: HistoryRef[]
  reload: () => Promise<void>
  reloadExternal: () => Promise<void>
  updateContent: (updater: (c: Content) => Content) => Promise<void>
  replaceContent: (c: Content) => Promise<void>
  discardDraft: () => Promise<void>
  restoreMyDraft: () => Promise<void>
  publishToServer: () => Promise<number>
  signIn: (
    name: string,
    password: string,
    options?: { replace?: boolean },
  ) => Promise<void>
  /** 授权通过后，用服务端发来的令牌直接登录 */
  adoptToken: (token: string) => Promise<void>
  signUp: (key: string, name: string, password: string) => Promise<void>
  createAdmin: (name: string, password: string, code: string) => Promise<string[]>
  signOut: () => Promise<void>
  updateProfile: (patch: {
    name?: string
    avatar?: string | null
    shownTitles?: string[]
  }) => Promise<void>
  changeMyPassword: (oldPassword: string, newPassword: string) => Promise<void>
  toggleFavorite: (type: FavRef['type'], id: string) => Promise<boolean>
  pushHistory: (type: HistoryRef['type'], id: string) => Promise<void>
  refreshHistory: () => Promise<void>
  toast: (message: string, type?: 'ok' | 'error') => void
  secureCrypto: boolean
}

const AppContext = createContext<AppContextValue | null>(null)

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp 必须在 AppProvider 内使用')
  return ctx
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<Content | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<AppMode>('checking')
  const [source, setSource] = useState<LoadResult['source']>('remote')
  const [conflict, setConflict] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [externalChange, setExternalChange] = useState(false)
  const [kicked, setKicked] = useState(false)
  const [networkOnline, setNetworkOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  )
  const [account, setAccount] = useState<SessionUser | null>(null)
  const [favorites, setFavorites] = useState<FavRef[]>([])
  const [history, setHistory] = useState<HistoryRef[]>([])

  const modeRef = useRef<AppMode>('checking')
  const remoteUpdatedAt = useRef<string>('')
  const channelRef = useRef<BroadcastChannel | null>(null)
  const toastSeq = useRef(0)

  const [toasts, setToasts] = useState<ToastItem[]>([])

  const toast = useCallback((message: string, type: 'ok' | 'error' = 'ok') => {
    toastSeq.current += 1
    const id = toastSeq.current
    setToasts((prev) => {
      // 同一条提示不重复堆叠，并且最多同时显示 3 条
      const deduped = prev.filter((t) => t.message !== message)
      return [...deduped, { id, message, type }].slice(-3)
    })
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 2800)
  }, [])

  /* ---------------- 内容加载 ---------------- */

  const applyResult = useCallback((result: LoadResult) => {
    setContent(result.content)
    setSource(result.source)
    setConflict(result.conflict)
    setDirty(result.source === 'draft')
  }, [])

  const loadFor = useCallback(
    async (current: AppMode) => {
      // 1. 线上后端
      if (current === 'online') {
        const remote = await api.getContent()
        if (remote) {
          const data = normaliseContent(remote.content)
          remoteUpdatedAt.current = data.updatedAt
          const draft = await loadDraft()
          applyResult(resolveContent(data, draft))
          await storageSet(CONTENT_CACHE_KEY, data)
          return
        }
      }
      // 2. 静态 content.json + 本地草稿
      const result = await loadContent()
      remoteUpdatedAt.current = result.content.updatedAt
      await storageSet(CONTENT_CACHE_KEY, result.content)
      applyResult(result)
    },
    [applyResult],
  )

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await commitPendingRestore()
      await loadFor(modeRef.current)
      setExternalChange(false)
    } catch (err) {
      const cached = await storageGet<Content>(CONTENT_CACHE_KEY)
      const draft = await loadDraft()
      if (cached) {
        if (draft && draft.baseUpdatedAt === cached.updatedAt) {
          applyResult(useDraftContent(draft))
        } else {
          applyResult({ content: cached, source: 'remote', conflict: !!draft, errors: [] })
        }
        setError('内容没加载出来，先显示上次的版本')
      } else {
        setError(err instanceof Error ? err.message : '内容加载失败')
      }
    } finally {
      setLoading(false)
    }
  }, [applyResult, loadFor])

  /* ---------------- 启动 ---------------- */

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      const online = await api.health()
      const next: AppMode = online ? 'online' : 'local'
      if (cancelled) return
      modeRef.current = next
      setMode(next)

      // 会话：先用缓存立刻显示「已登录」，再向后端确认
      if (next === 'online') {
        if (getToken()) {
          const cached = readCachedUser()
          if (cached && !cancelled) setAccount(cached)
          try {
            const { user } = await api.me()
            if (!cancelled) {
              setAccount(user)
              cacheUser(user)
            }
          } catch (err) {
            // 只有明确 401 才登出；网络抖动不能把人踢出去
            if (isAuthError(err)) {
              setToken(null)
              clearCachedUser()
              if (!cancelled) setAccount(null)
            }
          }
        }
      } else {
        const local = await loadSessionAccount()
        if (local && !cancelled) {
          setAccount({
            id: local.id,
            name: local.name,
            role: local.role === 'admin' ? 'superadmin' : local.role,
            verified: true,
          })
        }
      }

      try {
        await commitPendingRestore()
        await loadFor(next)
        if (!cancelled) setExternalChange(false)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '内容加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }

      if (!cancelled) {
        setFavorites(await listFavorites())
        setHistory(await listHistory())
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadFor])

  /* ---------------- 被其他设备顶掉 ---------------- */

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null)
      clearCachedUser()
      setAccount(null)
      try {
        localStorage.setItem('yacc:session-ended', '1')
      } catch {
        /* 忽略 */
      }
      setKicked(true)
    })
    return () => setUnauthorizedHandler(null)
  }, [toast])

  /* ---------------- 内容自动同步（别人发布的改动） ---------------- */

  usePolling(
    async () => {
      if (modeRef.current !== 'online' || dirty) return
      const remote = await api.getContent()
      if (!remote) return
      const data = normaliseContent(remote.content)
      if (data.updatedAt === remoteUpdatedAt.current) return
      remoteUpdatedAt.current = data.updatedAt
      setContent(data)
      setSource('remote')
      setConflict(false)
      await storageSet(CONTENT_CACHE_KEY, data)
      toast('内容已自动同步')
    },
    60_000,
    mode === 'online',
  )

  /* ---------------- 登录态巡检 ---------------- */

  useEffect(() => {
    if (mode !== 'online' || !account) return
    let stopped = false

    const check = async () => {
      if (stopped) return
      if (typeof document !== 'undefined' && document.hidden) return
      try {
        await api.me()
      } catch (err) {
        if (isAuthError(err)) setKicked(true)
      }
    }

    const timer = window.setInterval(() => void check(), 20_000)
    const onVisible = () => {
      if (!document.hidden) void check()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    return () => {
      stopped = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [mode, account])

  /* ---------------- 网络状态 / 跨标签 ---------------- */

  useEffect(() => {
    const on = () => setNetworkOnline(true)
    const off = () => setNetworkOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const ch = new BroadcastChannel('yacc-sync')
    ch.onmessage = (event: MessageEvent) => {
      if (event.data?.type === 'draft-updated') setExternalChange(true)
    }
    channelRef.current = ch
    return () => {
      ch.close()
      channelRef.current = null
    }
  }, [])

  /* ---------------- 草稿 ---------------- */

  const persistDraft = useCallback(async (next: Content) => {
    await saveDraft(makeDraft(next, remoteUpdatedAt.current))
    setDirty(true)
    setExternalChange(false)
    channelRef.current?.postMessage({ type: 'draft-updated' })
  }, [])

  const updateContent = useCallback(
    async (updater: (c: Content) => Content) => {
      if (!content) return
      const next = updater({ ...content, updatedAt: new Date().toISOString() })
      setContent(next)
      await persistDraft(next)
    },
    [content, persistDraft],
  )

  const replaceContent = useCallback(
    async (next: Content) => {
      setContent(next)
      await persistDraft(next)
    },
    [persistDraft],
  )

  const discardDraft = useCallback(async () => {
    await clearDraft()
    setDirty(false)
    await reload()
    toast('已回到线上版本')
  }, [reload, toast])

  const restoreMyDraft = useCallback(async () => {
    const draft = await loadDraft()
    if (!draft) {
      toast('本机没有草稿了', 'error')
      return
    }
    applyResult(useDraftContent(draft))
    toast('已切到你的本地草稿')
  }, [applyResult, toast])

  const publishToServer = useCallback(async () => {
    if (modeRef.current !== 'online') {
      throw new Error('当前不是在线模式：先用「导出内容包」发布')
    }
    if (!content) throw new Error('内容还没加载好')
    const { version } = await api.admin.publish(content)
    await clearDraft()
    setDirty(false)
    await reload()
    toast(`已发布第 ${version} 版`)
    return version
  }, [content, reload, toast])

  /* ---------------- 账号 ---------------- */

  const signIn = useCallback(async (
    name: string,
    password: string,
    options?: { replace?: boolean },
  ) => {
    if (modeRef.current === 'online') {
      const res = await api.login(name, password, options)
      setToken(res.token)
      cacheUser(res.user)
      setAccount(res.user)
      return
    }
    const acc = await localLogin(name, password)
    await localSetSession(acc.id)
    setAccount({
      id: acc.id,
      name: acc.name,
      role: acc.role === 'admin' ? 'superadmin' : acc.role,
      verified: true,
    })
  }, [])

  const adoptToken = useCallback(async (token: string) => {
    setToken(token)
    const res = await api.me()
    cacheUser(res.user)
    setAccount(res.user)
  }, [])

  const signUp = useCallback(async (key: string, name: string, password: string) => {
    if (modeRef.current === 'online') {
      const res = await api.register(name, password, key)
      setToken(res.token)
      cacheUser(res.user)
      setAccount(res.user)
      return
    }
    const acc = await localRegister({
      name,
      password,
      inviteCode: key,
      expectedInviteCode: content?.site.inviteCode ?? '',
      role: 'member',
    })
    await localSetSession(acc.id)
    setAccount({ id: acc.id, name: acc.name, role: acc.role, verified: true })
  }, [content])

  const createAdmin = useCallback(async (name: string, password: string, code: string) => {
    if (modeRef.current === 'online') {
      const res = await api.activateAdmin(name, password, code)
      setToken(res.token)
      cacheUser(res.user)
      setAccount(res.user)
      if (res.keys?.length) {
        await storageSet('yacc:first-keys', res.keys)
      }
      return res.keys ?? []
    }
    // 本地模式：激活码在构建配置里
    const expected =
      (import.meta.env.VITE_ADMIN_CODE as string | undefined)?.trim() || 'YACC-ADMIN-2026'
    if (code.trim() !== expected) throw new AuthError('激活码不对')
    const existing = await listLocalAdmins()
    if (existing) throw new AuthError('这台设备已经有管理员了，用那个账号登录吧')
    const acc = await localRegister({
      name,
      password,
      inviteCode: '',
      expectedInviteCode: '',
      role: 'admin',
    })
    await localSetSession(acc.id)
    setAccount({
      id: acc.id,
      name: acc.name,
      role: acc.role === 'admin' ? 'superadmin' : acc.role,
      verified: true,
    })
    return []
  }, [])

  const signOut = useCallback(async () => {
    if (modeRef.current === 'online') {
      try {
        await api.logout()
      } catch {
        /* 忽略 */
      }
      setToken(null)
      clearCachedUser()
    } else {
      await localClearSession()
    }
    setAccount(null)
  }, [])

  const updateProfile = useCallback(
    async (patch: { name?: string; avatar?: string | null; shownTitles?: string[] }) => {
      if (!account) throw new Error('未登录')
      if (modeRef.current === 'online') {
        // 头像和称号分开提交，避免一次改动互相覆盖
        if (patch.shownTitles) await api.profile({ shownTitles: patch.shownTitles })
        const res = await api.profile({ name: patch.name, avatar: patch.avatar })
        cacheUser(res.user)
        setAccount(res.user)
        return
      }
      // 离线模式只支持改昵称
      if (patch.name !== undefined) {
        const acc = await localRename(account.id, patch.name)
        setAccount({ ...account, name: acc.name })
      }
    },
    [account],
  )

  const changeMyPassword = useCallback(
    async (oldPassword: string, newPassword: string) => {
      if (!account) throw new Error('未登录')
      if (modeRef.current === 'online') {
        await api.changePassword(oldPassword, newPassword)
        return
      }
      await localChangePassword(account.id, oldPassword, newPassword)
    },
    [account],
  )

  /* ---------------- 收藏 / 历史 ---------------- */

  const toggleFavorite = useCallback(async (type: FavRef['type'], id: string) => {
    const result = await toggleFavStorage(type, id)
    setFavorites(result.list)
    return result.added
  }, [])

  const pushHistory = useCallback(async (type: HistoryRef['type'], id: string) => {
    const next = await recordHistory(type, id)
    setHistory(next)
  }, [])

  const refreshHistory = useCallback(async () => {
    setHistory(await listHistory())
  }, [])

  const dismissKicked = useCallback(() => setKicked(false), [])

  const reloadExternal = useCallback(async () => {
    await reload()
    setExternalChange(false)
  }, [reload])

  const value = useMemo<AppContextValue>(
    () => ({
      content,
      loading,
      error,
      mode,
      source,
      conflict,
      dirty,
      externalChange,
      kicked,
      dismissKicked,
      online: networkOnline,
      account,
      favorites,
      history,
      reload,
      reloadExternal,
      updateContent,
      replaceContent,
      discardDraft,
      restoreMyDraft,
      publishToServer,
      signIn,
      adoptToken,
      signUp,
      createAdmin,
      signOut,
      updateProfile,
      changeMyPassword,
      toggleFavorite,
      pushHistory,
      refreshHistory,
      toast,
      secureCrypto: isSecureCryptoAvailable(),
    }),
    [
      content,
      loading,
      error,
      mode,
      source,
      conflict,
      dirty,
      externalChange,
      kicked,
      dismissKicked,
      networkOnline,
      account,
      favorites,
      history,
      reload,
      reloadExternal,
      updateContent,
      replaceContent,
      discardDraft,
      restoreMyDraft,
      publishToServer,
      signIn,
      adoptToken,
      signUp,
      createAdmin,
      signOut,
      updateProfile,
      changeMyPassword,
      toggleFavorite,
      pushHistory,
      refreshHistory,
      toast,
    ],
  )

  return (
    <AppContext.Provider value={value}>
      {children}
      {toasts.length > 0 ? (
        <div className="toast-wrap" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast${t.type === 'error' ? ' toast--error' : ''}`}>
              {t.message}
            </div>
          ))}
        </div>
      ) : null}
    </AppContext.Provider>
  )
}

/* ---------------- 辅助 ---------------- */

async function listLocalAdmins(): Promise<boolean> {
  const { listAccounts } = await import('../data/accounts')
  const accounts = await listAccounts()
  return accounts.some((a) => a.role === 'admin')
}

export { AuthError }
