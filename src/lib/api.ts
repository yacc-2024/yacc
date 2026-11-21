/**
 * 在线模式的 API 客户端。
 * 本地模式（没有后端）不会用到这里的任何函数。
 */

const TOKEN_KEY = 'yacc:token'

let onUnauthorized: (() => void) | null = null

/** 请求带着 token 却被拒（多半是被别的设备顶掉），交给上层处理 */
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export type AdminPerm = 'content' | 'users' | 'keys' | 'comments'

export interface SessionUser {
  id: string
  /** 固定的数字账号 ID，注册后不再变化 */
  uid?: number | null
  name: string
  avatar?: string | null
  /** 管理员定制的称号 */
  title?: string | null
  role: 'superadmin' | 'admin' | 'member' | 'visitor'
  verified: boolean
  perms?: AdminPerm[]
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* 隐私模式忽略 */
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  const headers: Record<string, string> = {}
  if (options.body !== undefined) headers['content-type'] = 'application/json'
  const token = options.token ?? getToken()
  if (token) headers.authorization = `Bearer ${token}`

  const res = await fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })

  let payload: unknown = null
  try {
    payload = await res.json()
  } catch {
    payload = null
  }

  if (!res.ok) {
    const message =
      (payload as { error?: string } | null)?.error ?? `请求失败（${res.status}）`
    const isAuthRoute = path.startsWith('/auth/login') || path.startsWith('/auth/register')
    if (res.status === 401 && token && !isAuthRoute) {
      onUnauthorized?.()
    }
    throw new ApiError(message, res.status)
  }
  return payload as T
}

interface Envelope<T> {
  ok: boolean
  data: T
}

async function call<T>(
  path: string,
  options: Parameters<typeof request>[1] = {},
): Promise<T> {
  const res = await request<Envelope<T>>(path, options)
  return res.data
}

/* ---------------- 接口 ---------------- */

export const api = {
  /** 探测后端是否存在；不存在就退回本地模式 */
  async health(): Promise<boolean> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const res = await request<Envelope<{ service: string }>>('/health')
        if (res.ok === true && res.data?.service === 'yacc') return true
      } catch {
        /* 冷启动可能第一次超时，重试一次 */
      }
      if (attempt === 0) await new Promise((r) => setTimeout(r, 800))
    }
    return false
  },

  /** 内容不是信封结构，单独处理 */
  async getContent(): Promise<{ content: unknown; publishedAt: string | null } | null> {
    const res = await fetch('/api/content', { headers: authHeader() })
    if (res.status === 404) return null
    if (!res.ok) throw new ApiError('内容加载失败', res.status)
    return { content: await res.json(), publishedAt: res.headers.get('x-published-at') }
  },

  login: (name: string, password: string) =>
    call<{ token: string; user: SessionUser }>('/auth/login', {
      method: 'POST',
      body: { name, password },
    }),

  register: (name: string, password: string, key: string) =>
    call<{ token: string; user: SessionUser }>('/auth/register', {
      method: 'POST',
      body: { name, password, key },
    }),

  activateAdmin: (name: string, password: string, code: string) =>
    call<{ token: string; user: SessionUser; keys: string[] }>('/auth/activate-admin', {
      method: 'POST',
      body: { name, password, code },
    }),

  me: () => call<{ user: SessionUser }>('/auth/me'),

  logout: () => call<Record<string, never>>('/auth/logout', { method: 'POST' }),

  profile: (patch: { name?: string; avatar?: string | null }) =>
    call<{ user: SessionUser }>('/auth/profile', { method: 'POST', body: patch }),

  changePassword: (oldPassword: string, newPassword: string) =>
    call<Record<string, never>>('/auth/password', {
      method: 'POST',
      body: { oldPassword, newPassword },
    }),

  memberLinks: () =>
    call<{
      links: Array<{ memberId: string; uid: string; name: string; avatar: string | null }>
    }>('/members/links'),

  userProfile: (uid: string) =>
    call<{
      user: {
        uid: string
        rawUid: number | null
        name: string
        avatar: string | null
        role: string
        verified: boolean
        memberSince: string
        label: string
        title: string | null
        commentCount: number
      }
    }>(`/users/${uid}`),

  comments: (targetType: string, targetId: string) =>
    call<{
      comments: Array<{
        id: string
        body: string
        createdAt: string
        author: string
        avatar: string | null
        uid: string
        mine: boolean
      }>
      me: SessionUser | null
    }>(`/comments?targetType=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(targetId)}`),

  postComment: (targetType: string, targetId: string, body: string) =>
    call<{ id: string; status: string }>('/comments', {
      method: 'POST',
      body: { targetType, targetId, body },
    }),

  deleteComment: (id: string) =>
    call<Record<string, never>>(`/comments/${id}`, { method: 'DELETE' }),

  reactions: (targetType: string, targetId: string) =>
    call<{ count: number; mine: boolean }>(
      `/reactions?targetType=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(targetId)}`,
    ),

  toggleReaction: (targetType: string, targetId: string) =>
    call<{ active: boolean; count: number }>('/reactions/toggle', {
      method: 'POST',
      body: { targetType, targetId },
    }),

  settings: () => call<{ moderation: string }>('/settings'),

  admin: {
    publish: (content: unknown) =>
      call<{ version: number }>('/admin/publish', { method: 'POST', body: { content } }),

    keys: () =>
      call<{
        keys: Array<{
          code: string
          kind: string
          spec: string | null
          specLabel: string
          note: string
          createdAt: string
          usedAt: string | null
          usedBy: string | null
          expiresAt: string | null
        }>
      }>('/admin/keys'),

    createKeys: (
      spec: {
        kind: 'crew' | 'member' | 'admin'
        role?: number
        season?: number
        grade?: number
        klass?: number
        memberId?: string
        memberName?: string
        perms?: AdminPerm[]
      },
      count: number,
      expiresInDays: number,
      note: string,
    ) =>
      call<{ keys: string[] }>('/admin/keys', {
        method: 'POST',
        body: { ...spec, count, expiresInDays, note },
      }),

    revokeKey: (code: string) =>
      call<Record<string, never>>(`/admin/keys/${code}`, { method: 'DELETE' }),

    comments: (status: string) =>
      call<{
        comments: Array<{
          id: string
          body: string
          status: string
          createdAt: string
          targetType: string
          targetId: string
          author: string
        }>
      }>(`/admin/comments?status=${status}`),

    moderate: (id: string, status: 'published' | 'hidden' | 'pending') =>
      call<Record<string, never>>(`/admin/comments/${id}`, {
        method: 'POST',
        body: { status },
      }),

    users: () =>
      call<{
        users: Array<{
          id: string
          uid: string
          name: string
          avatar: string | null
          role: string
          verified: boolean
          label: string
          title: string | null
          keyCode: string | null
          createdAt: string
        }>
      }>('/admin/users'),

    setVerified: (id: string, verified: boolean) =>
      call<Record<string, never>>(`/admin/users/${id}`, {
        method: 'POST',
        body: { verified },
      }),

    updateUser: (
      id: string,
      patch: { name?: string; password?: string; verified?: boolean; title?: string | null },
    ) =>
      call<Record<string, never>>(`/admin/users/${id}`, { method: 'POST', body: patch }),

    deleteUser: (id: string) =>
      call<{ deleted: string }>(`/admin/users/${id}`, { method: 'DELETE' }),

    setUid: (id: string, uid: number) =>
      call<{ uid: string }>(`/admin/users/${id}/uid`, { method: 'POST', body: { uid } }),

    setModeration: (moderation: 'on' | 'off') =>
      call<{ moderation: string }>('/admin/settings', {
        method: 'POST',
        body: { moderation },
      }),
  },
}

function authHeader(): Record<string, string> {
  const token = getToken()
  return token ? { authorization: `Bearer ${token}` } : {}
}

/* ---------------- 登录态缓存 ---------------- */

const USER_KEY = 'yacc:user'

/** 把用户信息缓存一份，网络不好时也能显示成已登录 */
export function cacheUser(user: SessionUser): void {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch {
    /* 忽略 */
  }
}

export function readCachedUser(): SessionUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SessionUser
    return parsed?.id && parsed?.name ? parsed : null
  } catch {
    return null
  }
}

export function clearCachedUser(): void {
  try {
    localStorage.removeItem(USER_KEY)
  } catch {
    /* 忽略 */
  }
}

/** 只有确认是「未登录/过期」才清 token */
export function isAuthError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401
}
