import { CURRENT_SCHEMA } from './schema'

/** 每个版本的迁移函数：把 vN 的数据改成 vN+1 */
const STEPS: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {
  // v1 是首个版本，暂无迁移
}

export class MigrationError extends Error {}

/**
 * 把任意版本的 content 迁移到当前版本。
 * 高于当前版本 -> 抛错（由调用方提示用户更新应用）
 */
export function migrate(content: unknown): Record<string, unknown> {
  if (typeof content !== 'object' || content === null) {
    throw new MigrationError('内容不是对象，无法迁移')
  }
  let data = content as Record<string, unknown>
  const from = data.schemaVersion
  if (typeof from !== 'number' || !Number.isInteger(from) || from < 1) {
    throw new MigrationError('缺少有效的 schemaVersion')
  }
  if (from > CURRENT_SCHEMA) {
    throw new MigrationError(
      `备份来自更新版本（v${from}），当前最高支持 v${CURRENT_SCHEMA}`,
    )
  }
  let version = from
  while (version < CURRENT_SCHEMA) {
    const step = STEPS[version]
    if (!step) {
      throw new MigrationError(`缺少 v${version} → v${version + 1} 的迁移方案`)
    }
    data = step(data)
    version += 1
    data.schemaVersion = version
  }
  return data
}
