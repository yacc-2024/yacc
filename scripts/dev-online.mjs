/**
 * 一键起「前端 + 本地 API」。
 * 用法：pnpm dev:online
 */
import { spawn } from 'node:child_process'
import { build } from 'esbuild'
import { mkdirSync } from 'node:fs'

mkdirSync('.data', { recursive: true })

await build({
  entryPoints: ['server/dev.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile: '.data/api.mjs',
  external: ['node:sqlite'],
  logLevel: 'error',
})

const children = []
const run = (cmd, args, name) => {
  const child = spawn(cmd, args, { stdio: 'inherit', env: process.env })
  child.on('exit', (code) => {
    if (code !== 0) console.error(`${name} 退出，代码 ${code}`)
  })
  children.push(child)
  return child
}

run(process.execPath, ['.data/api.mjs'], 'api')
run(process.execPath, ['node_modules/vite/bin/vite.js', '--host'], 'web')

const shutdown = () => {
  children.forEach((c) => c.kill('SIGTERM'))
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
