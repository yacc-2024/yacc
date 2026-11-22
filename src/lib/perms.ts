/** 管理员权限清单（分组展示） */
export interface PermGroup {
  title: string
  items: Array<[value: string, label: string]>
}

export const PERM_GROUPS: PermGroup[] = [
  {
    title: '内容',
    items: [
      ['content:home', '主页管理'],
      ['content:about', '关于页面'],
      ['content:members', '成员管理'],
      ['content:works', '作品管理'],
      ['content:changelog', '更新日志'],
      ['content:publish', '发布内容'],
    ],
  },
  {
    title: '账号',
    items: [
      ['users:view', '查看账号'],
      ['users:edit', '编辑资料'],
      ['users:delete', '删除账号'],
      ['users:uid', '修改编号'],
    ],
  },
  {
    title: '密钥',
    items: [
      ['keys:issue', '发放密钥'],
      ['keys:revoke', '作废密钥'],
    ],
  },
  {
    title: '评论',
    items: [['comments:review', '审核评论']],
  },
]

/** 旧的四类权限 → 新细分权限，用于勾选状态展示 */
export const LEGACY_CHILDREN: Record<string, string[]> = {
  content: PERM_GROUPS[0].items.map((i) => i[0]),
  users: PERM_GROUPS[1].items.map((i) => i[0]),
  keys: PERM_GROUPS[2].items.map((i) => i[0]),
  comments: PERM_GROUPS[3].items.map((i) => i[0]),
}

/** 把权限列表展开成细分权限集合（旧权限算包含其子项） */
export function expandPerms(perms: string[]): Set<string> {
  const set = new Set(perms)
  for (const [parent, children] of Object.entries(LEGACY_CHILDREN)) {
    if (perms.includes(parent)) children.forEach((c) => set.add(c))
  }
  return set
}
