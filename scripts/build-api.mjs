/**
 * 把 server/dev.ts 打成可以直接给 node 跑的单文件，
 * 避免为了跑一个本地 API 引入 ts-node / tsx。
 */
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

console.log('built .data/api.mjs')
