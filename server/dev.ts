/**
 * 本地 API 服务（开发用）。
 * 运行：pnpm api
 */
import { createServer } from 'node:http'
import { DatabaseSync } from 'node:sqlite'
import { createNodeDb } from './db'
import { handleApi } from './app'

const port = Number(process.env.API_PORT ?? 8788)
const dbPath = process.env.DB_PATH ?? '.data/yacc.db'
const adminCode = process.env.YACC_ADMIN_CODE ?? 'YACC-ADMIN-2026'

const db = createNodeDb(dbPath, DatabaseSync as never)

const server = createServer(async (req, res) => {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const body = Buffer.concat(chunks)

  const request = new Request(`http://127.0.0.1:${port}${req.url ?? '/'}`, {
    method: req.method,
    headers: req.headers as Record<string, string>,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
  })

  try {
    const response = await handleApi(request, { db, adminCode })
    const headers: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      headers[key] = value
    })
    res.writeHead(response.status, headers)
    res.end(Buffer.from(await response.arrayBuffer()))
  } catch (err) {
    res.writeHead(500, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: String(err) }))
  }
})

server.listen(port, '0.0.0.0', () => {
  console.log(`API 已启动 http://127.0.0.1:${port}/api`)
  console.log(`数据库 ${dbPath} · 管理员口令 ${adminCode}`)
})
