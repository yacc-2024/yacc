export interface Privacy {
  showFollowing: boolean
  showFollowers: boolean
  showPopularity: boolean
  showPosts: boolean
}

export const DEFAULT_PRIVACY: Privacy = {
  showFollowing: true,
  showFollowers: true,
  showPopularity: true,
  showPosts: true,
}

export const PRIVACY_LABELS: Array<[keyof Privacy, string, string]> = [
  ['showFollowing', '公开我的关注列表', '别人可以查看你关注了谁'],
  ['showFollowers', '公开我的粉丝列表', '别人可以查看谁关注了你'],
  ['showPopularity', '在主页显示人气值', '关掉后只有你自己能看'],
  ['showPosts', '让别人看到我发过的帖子', '关掉后主页帖子区不展示'],
]
