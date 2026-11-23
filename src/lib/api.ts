/**
 * 在线模式的 API 客户端。
 * 本地模式（没有后端）不会用到这里的任何函数。
 */

const TOKEN_KEY = 'yacc:token'
const CACHE_PREFIX = 'yacc:cache:'

interface CacheBox<T> {
  at: number
  data: T
}

/** 读本地缓存；过期返回 null */
function readCache<T>(key: string, ttl: number): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const box = JSON.parse(raw) as CacheBox<T>
    if (Date.now() - box.at > ttl) return null
    return box.data
  } catch {
    return null
  }
}

/** 只保留最近 25 条缓存，避免 localStorage 越滚越大拖慢读写 */
function pruneCache(): void {
  try {
    const keys: Array<{ k: string; at: number }> = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i)
      if (!k || !k.startsWith(CACHE_PREFIX)) continue
      let at = 0
      try {
        at = (JSON.parse(localStorage.getItem(k) ?? '{}') as { at?: number }).at ?? 0
      } catch {
        at = 0
      }
      keys.push({ k, at })
    }
    if (keys.length <= 25) return
    keys.sort((a, b) => a.at - b.at)
    for (const item of keys.slice(0, keys.length - 25)) localStorage.removeItem(item.k)
  } catch {
    /* 忽略 */
  }
}

function writeCache<T>(key: string, data: T): void {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), data }))
    pruneCache()
  } catch {
    /* 空间满了就算了 */
  }
}

/** 每台设备一个固定编号，用来记住「这台已经授权过」 */
export function deviceId(): string {
  if (typeof localStorage === 'undefined') return ''
  const key = 'yacc:device-id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    localStorage.setItem(key, id)
  }
  return id
}

/** 给服务器看的设备名，方便在主设备上区分 */
export function deviceLabel(): string {
  if (typeof navigator === 'undefined') return '未知设备'
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? '安卓手机' : '安卓平板'
  if (/Macintosh/.test(ua)) return 'Mac 电脑'
  if (/Windows/.test(ua)) return 'Windows 电脑'
  return '浏览器'
}

/**
 * 网页版走同源的 /api；装成 apk 后页面在本地壳里，
 * 构建时用 VITE_API_BASE=https://yacc2026.pages.dev 指到线上。
 */
const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')

let onUnauthorized: (() => void) | null = null

/** 请求带着 token 却被拒（多半是被别的设备顶掉），交给上层处理 */
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn
}

export class ApiError extends Error {
  status: number
  data: unknown
  constructor(message: string, status: number, data?: unknown) {
    super(message)
    this.status = status
    this.data = data
  }
}

export interface ForumPost {
  id: string
  body: string
  createdAt: string
  views: number
  author: string
  avatar: string | null
  uid: string
  authorId: string
  badge?: string
  badgeKind?: 'admin' | 'crew' | 'member' | 'guest'
  badgeStyle?: string | null
  titleStyles?: Record<string, string>
  label: string
  likes: number
  comments?: number
  liked: boolean
  following: boolean
  mine: boolean
  pinned?: boolean
  images: string[]
}

export interface CommentItem {
  id: string
  body: string
  createdAt: string
  author: string
  avatar: string | null
  uid: string
  mine: boolean
  pinned: boolean
  likes: number
  liked: boolean
  parentId: string | null
  replyToName: string | null
  replies?: CommentItem[]
}

export type AdminPerm = 'content' | 'users' | 'keys' | 'comments'

export interface SessionUser {
  id: string
  /** 固定的数字账号 ID，注册后不再变化 */
  uid?: number | null
  name: string
  avatar?: string | null
  /** 管理员发过的所有称号 */
  titles?: string[]
  /** 自己选择展示的称号（最多 3 个） */
  shownTitles?: string[]
  badgeStyle?: string | null
  titleStyles?: Record<string, string>
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

  const res = await fetch(`${API_BASE}/api${path}`, {
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
    throw new ApiError(message, res.status, payload)
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
    const res = await fetch(`${API_BASE}/api/content`, { headers: authHeader() })
    if (res.status === 404) return null
    if (!res.ok) throw new ApiError('内容加载失败', res.status)
    return { content: await res.json(), publishedAt: res.headers.get('x-published-at') }
  },

  login: (name: string, password: string, options?: { replace?: boolean; device?: string }) =>
    call<{ token: string; user: SessionUser }>('/auth/login', {
      method: 'POST',
      body: {
        name,
        password,
        replace: options?.replace ?? false,
        device: options?.device ?? deviceLabel(),
        deviceId: deviceId(),
      },
    }),

  requestStatus: (id: string) =>
    call<{ status: string; token: string | null }>(`/auth/request-status?id=${encodeURIComponent(id)}`),

  authRequests: () =>
    call<{ requests: Array<{ id: string; device: string; createdAt: string }> }>('/auth/requests'),

  decideRequest: (id: string, action: 'approve' | 'deny') =>
    call<Record<string, never>>(`/auth/requests/${id}`, { method: 'POST', body: { action } }),

  sessions: () =>
    call<{
      sessions: Array<{ key: string; name: string; createdAt: string; current: boolean }>
    }>('/auth/sessions'),

  removeDevice: (key: string) =>
    call<Record<string, never>>(`/auth/devices/${encodeURIComponent(key)}`, { method: 'DELETE' }),

  revokeCurrentSession: () =>
    call<Record<string, never>>('/auth/session', { method: 'DELETE' }),

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

  profile: (patch: {
    name?: string
    avatar?: string | null
    shownTitles?: string[]
    badgeStyle?: string | null
    titleStyles?: Record<string, string>
    signature?: string
    hideBadge?: boolean
  }) =>
    call<{ user: SessionUser }>('/auth/profile', { method: 'POST', body: patch }),

  changePassword: (oldPassword: string, newPassword: string) =>
    call<Record<string, never>>('/auth/password', {
      method: 'POST',
      body: { oldPassword, newPassword },
    }),

  posts: async (limit = 20, offset = 0, userId = '') => {
    const path = `/posts?limit=${limit}&offset=${offset}${userId ? `&userId=${encodeURIComponent(userId)}` : ''}`
    const key = `posts:${path}`
    const cached = readCache<{ posts: ForumPost[] }>(key, 120_000)
    if (cached) {
      // 先返回缓存，后台悄悄更新
      void call<{ posts: ForumPost[] }>(path).then((fresh) => writeCache(key, fresh)).catch(() => {})
      return cached
    }
    const fresh = await call<{ posts: ForumPost[] }>(path)
    writeCache(key, fresh)
    return fresh
  },

  createPost: (body: string, images: string[]) =>
    call<{ id: string }>('/posts', { method: 'POST', body: { body, images } }),

  post: async (id: string) => {
    const key = `post:${id}`
    const cached = readCache<{ post: ForumPost }>(key, 120_000)
    if (cached) {
      void call<{ post: ForumPost }>(`/posts/${id}`).then((fresh) => writeCache(key, fresh)).catch(() => {})
      return cached
    }
    const fresh = await call<{ post: ForumPost }>(`/posts/${id}`)
    writeCache(key, fresh)
    return fresh
  },

  deletePost: (id: string) => call<Record<string, never>>(`/posts/${id}`, { method: 'DELETE' }),

  pinPost: (id: string, pinned: boolean) =>
    call<Record<string, never>>(`/posts/${id}/pin`, { method: 'POST', body: { pinned } }),

  userContent: (uid: string) =>
    call<{
      posts: Array<{ id: string; body: string; createdAt: string; pinned: boolean }>
      comments: Array<{
        id: string
        body: string
        createdAt: string
        targetType: string
        targetId: string
      }>
    }>(`/users/${uid}/content`),

  likePost: (id: string) =>
    call<{ liked: boolean; likes: number }>(`/posts/${id}/like`, { method: 'POST' }),

  follow: (userId: string, action: 'follow' | 'unfollow') =>
    call<{ following: boolean }>(`/follows/${userId}`, { method: 'POST', body: { action } }),

  memberLinks: () =>
    call<{
      links: Array<{ memberId: string; uid: string; name: string; avatar: string | null }>
    }>('/members/links'),

  userProfile: async (uid: string) => {
    const key = `profile:${uid}`
    const cached = readCache<{ user: never }>(key, 120_000)
    if (cached) {
      void call<{ user: never }>(`/users/${uid}`).then((fresh) => writeCache(key, fresh)).catch(() => {})
      return cached
    }
    const fresh = await call<{ user: never }>(`/users/${uid}`)
    writeCache(key, fresh)
    return fresh
  },

  userProfileUncached: (uid: string) =>
    call<{
      user: {
        uid: string
        rawUid: number | null
        name: string
        avatar: string | null
        role: string
        verified: boolean
        memberSince: string
        memberId: string | null
        followers: number
        followingCount: number
        likes: number
        isFollowing: boolean
        followsMe: boolean
        isMe: boolean
        signature: string | null
        hideBadge: boolean
        visitors: Array<{ uid: string; name: string; avatar: string | null; at: string }>
        badgeStyle: string | null
        titleStyles: Record<string, string>
        userId: string
        postCount: number
        label: string
        titles: string[]
        shownTitles: string[]
        commentCount: number
      }
    }>(`/users/${uid}`),

  comments: (targetType: string, targetId: string) =>
    call<{
      comments: CommentItem[]
      me: SessionUser | null
      moderation: string
    }>(`/comments?targetType=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(targetId)}`),

  replyComment: (input: {
    targetType: string
    targetId: string
    body: string
    parentId: string
  }) => call<{ id: string; status: string }>('/comments', { method: 'POST', body: input }),

  pinComment: (id: string, pinned: boolean) =>
    call<Record<string, never>>(`/comments/${id}/pin`, { method: 'POST', body: { pinned } }),

  likeComment: (id: string) =>
    call<{ liked: boolean; likes: number }>(`/comments/${id}/like`, { method: 'POST' }),

  notifications: async () => {
    type Inbox = {
      notifications: Array<{
        id: string
        type: string
        category?: string
        commentId: string | null
        targetType: string | null
        targetId: string | null
        actorName: string
        body: string
        createdAt: string
        read: boolean
      }>
      unread: number
    }
    const cached = readCache<Inbox>('notifications', 60_000)
    if (cached) {
      void call<Inbox>('/notifications')
        .then((fresh) => writeCache('notifications', fresh))
        .catch(() => {})
      return cached
    }
    const fresh = await call<Inbox>('/notifications')
    writeCache('notifications', fresh)
    return fresh
  },

  notificationsUncached: () =>
    call<{
      notifications: Array<{
        id: string
        type: string
        category?: string
        commentId: string | null
        targetType: string | null
        targetId: string | null
        actorName: string
        body: string
        createdAt: string
        read: boolean
      }>
      unread: number
    }>('/notifications'),

  readNotifications: () =>
    call<Record<string, never>>('/notifications/read', { method: 'POST' }),

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
    versions: () =>
      call<{
        versions: Array<{ version: number; publishedAt: string; publisher: string; size: number }>
      }>('/admin/versions'),

    rollback: (version: number) =>
      call<{ version: number }>('/admin/rollback', { method: 'POST', body: { version } }),

    publish: (content: unknown, baseUpdatedAt?: string) =>
      call<{ version: number }>('/admin/publish', {
        method: 'POST',
        body: { content, baseUpdatedAt },
      }),

    activity: () =>
      call<{
        activity: Array<{
          id: string
          userName: string
          action: string
          detail: string
          createdAt: string
        }>
      }>('/admin/activity'),

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

    moderate: (id: string, status: 'published' | 'hidden' | 'pending' | 'delete') =>
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
          titles: string[]
          perms: string[]
          badgeStyle: string | null
          titleStyles: Record<string, string>
          memberId: string | null
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
      patch: {
        name?: string
        password?: string
        verified?: boolean
        titles?: string[]
        memberId?: string | null
        perms?: string[]
        role?: 'admin' | 'visitor'
        badgeStyle?: string | null
  titleStyles?: Record<string, string>
      },
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
