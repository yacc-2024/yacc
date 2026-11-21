export function uid(prefix: string): string {
  const t = Date.now().toString(36)
  const r = Math.floor(Math.random() * 1296).toString(36)
  return `${prefix}-${t}${r}`
}
