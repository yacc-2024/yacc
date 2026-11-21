/**
 * Cloudflare Worker 入口（可选部署方式）。
 *
 * 如果你不想新建 Pages 项目、想直接复用已有的 yacc Worker，
 * 用这个入口：同一个 Worker 同时提供 /api/* 接口和静态页面。
 *
 * 部署：npx wrangler deploy
 */
import { createD1Db } from '../server/db'
import { handleApi } from '../server/app'

interface Fetcher {
  fetch(request: Request): Promise<Response>
}

interface Env {
  DB: unknown
  ASSETS: Fetcher
  ADMIN_CODE?: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)

    if (pathname === '/api' || pathname.startsWith('/api/')) {
      return handleApi(request, {
        db: createD1Db(env.DB),
        adminCode: env.ADMIN_CODE ?? '',
      })
    }

    // 其余请求交给静态资源（SPA 回退由 wrangler 的 not_found_handling 处理）
    return env.ASSETS.fetch(request)
  },
}
