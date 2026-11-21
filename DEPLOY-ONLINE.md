# 在线化部署指南

把 yacc 从「数据存本机」升级成「真正的在线服务」。做完之后：

- 管理员在手机上点「发布」，所有人立刻看到，不用再替换文件
- 有账号体系：认证访客、认证访客、管理员
- 认证访客可以评论、点赞，你要审核
- 数据在云端，换手机不丢

---

## 〇、先选一条路

这套代码支持两种部署方式，**用的后端逻辑完全一样**，只是「壳」不同。

| | A · 新建 Pages 项目（推荐） | B · 复用已有的 yacc Worker |
| --- | --- | --- |
| 适合谁 | 手上没有正在跑的 Worker，或者旧 Worker 只是试玩 | 已经有 Worker 挂着你的域名 / 正在对外服务 |
| 要做什么 | 控制台点几下，连 Git，自动部署 | 加 `wrangler.jsonc` + `worker/index.ts`（已备好），`npx wrangler deploy` |
| 入口文件 | `functions/api/[[route]].ts` | `worker/index.ts` |
| 部署方式 | 推 Git 自动构建 | 跑一次 wrangler 命令，或接 Workers Builds |
| 域名 | 新的 `xxx.pages.dev`，要绑域名得再切一次 | 原地升级，域名不用动 |
| 风险 | 旧站点先别删，等新的验证完再切 | 会覆盖旧 Worker 的部署，**先确认旧站不用了** |

**判断标准只有一个：那个 Worker 现在还有人在访问吗？**

- 有（域名指过去了 / 发过链接给人）→ 选 B，原地升级，不用换地址
- 没有（当年随便点的，或者已经废弃）→ 选 A，把旧 Worker 删掉，避免以后混淆

⚠️ 别做的事：在旧 Worker 上加 D1 绑定，却部署 Pages 的代码 —— 绑定不生效，接口会 500。

---

## 一、架构

```
浏览器（React PWA）
   │  /api/*
   ▼
Cloudflare Pages Functions  ──►  D1（SQLite）
（functions/api/[[route]].ts）      用户 / 会话 / 密钥 / 内容 / 评论 / 点赞
```

同源、同一次部署、免费额度足够（D1 免费 5GB，每天 500 万次读）。

本地开发时，`functions` 那层换成 `server/dev.ts` 的 Node 服务，用 Node 24 内置的 SQLite，
**代码是同一份**，所以本地测过就等于线上跑过。

---

## 二、你需要准备

1. 一个 Cloudflare 账号（免费）
2. 一个 GitHub 仓库（放这个项目）
3. 两个口令：
   - **管理员口令**：第一次创建管理员时用，随便设一串长的
   - 认证访客/访客的密钥由管理员后台生成，不需要提前准备

---

## 三、部署步骤（方案 A：Pages）

### 1. 建 D1 数据库

Cloudflare 控制台 → **Workers & Pages → D1** → Create database

名字填 `yacc`，创建后记下 **Database ID**。

### 2. 建 Pages 项目

Cloudflare 控制台 → **Workers & Pages → Create → Pages → Connect to Git** → 选仓库

| 配置项 | 值 |
| --- | --- |
| Framework preset | 无 / None |
| Build command | `pnpm build` |
| Build output directory | `dist` |
| Root directory | 留空 |

### 3. 绑定数据库

Pages 项目 → **Settings → Functions → D1 database bindings** → Add

| 变量名 | 值 |
| --- | --- |
| `DB` | 选刚建的 `yacc` |

**变量名必须是 `DB`**，代码里写死了。

### 4. 设置管理员口令

Pages 项目 → **Settings → Variables and Secrets** → Add

| 名称 | 类型 | 值 |
| --- | --- | --- |
| `ADMIN_CODE` | Secret | 你自己想的一串，别告诉别人 |

### 5. 部署

推一次代码，Pages 会自动构建。第一次打开站点后：

1. 进 `/login?mode=admin`
2. 输入 `ADMIN_CODE` 里那串口令
3. 设昵称和密码
4. 系统会顺手生成 **6 个认证密钥**，在「管理中心 → 密钥管理」里能看到

### 6. 建表

不需要手动执行 SQL —— 第一次调用 `/api/health` 时会自动建表。
想手动执行的话，SQL 在 `server/schema.sql`：

```bash
npx wrangler d1 execute yacc --remote --file=server/schema.sql
```

---

## 四、本地先跑一遍

```bash
pnpm dev:online
```

会同时起：

- 前端 http://localhost:5173
- 后端 http://localhost:8788/api

手机同 WiFi 打开 http://192.168.x.x:5173 也能用（后端走代理）。

数据库文件在 `.data/yacc.db`，删掉就是重置。

---

## 五、发布内容

在线模式下，管理中心的「数据管理」里会出现 **发布到线上** 按钮。

改完内容 → 点发布 → 别人刷新就能看到。

「导出内容包 / 导入备份」仍然保留，作为离线兜底和灾难恢复。

---

## 六、发密钥

「管理中心 → 密钥管理」：

| 类型 | 给谁 | 作用 |
| --- | --- | --- |
| 访客认证 | 校外同学、老师 | 能看 + 能评论 + 能点赞 |
| 认证访客 | 剧组自己人 | 同上，标记为成员 |

- 每个密钥**只能用一次**
- 可以设有效天数，过期自动失效
- 没用掉的可以「作废」
- 生成后可以一键复制，直接发群里

**普通访客**（没密钥的人）只能看，不能评论。

---

## 七、评论审核

默认 **先审后发**：评论进来后只有你能看到，通过后才公开。

「管理中心 → 评论审核」里可以：

- 看「待审核 / 已发布 / 已隐藏」
- 通过、隐藏
- 一键切换「先审后发」开关

---

## 八、费用

| 项目 | 免费额度 | 你们的用量 |
| --- | --- | --- |
| Pages | 无限请求 | 够 |
| Functions | 每天 10 万次 | 几十人一天几百次 |
| D1 | 5GB 存储 / 每天 500 万行读 | 差好几个数量级 |

**实际就是 0 元。** 唯一可能超的是 Functions 的 CPU 时间（每天 10 万 GB·秒），你们的量到不了。

---

## 九、已知限制

| 限制 | 说明 | 什么时候处理 |
| --- | --- | --- |
| 收藏和历史仍是本机 | 换设备会丢，因为还没做云端同步 | 下一版 |
| 没有找回密码 | 忘记密码只能管理员改数据库，或重发密钥注册新号 | 需要邮箱服务，暂不做 |
| 评论没有分页 | 一次最多 200 条 | 评论过百再说 |
| 没有防刷 | 同一账号可以连续发评论 | 真被刷再加冷却 |
| 没有图片/头像上传 | 头像仍用 URL | 需要对象存储 |

---

## 十、回滚

如果线上出问题：

1. **内容**：D1 里 `documents` 表保留了每一版，把上一版重新发布即可
2. **代码**：Cloudflare 的 Deployments 页面可以一键回滚到上一个版本
3. **完全退回离线版**：删掉 `functions/` 目录重新部署，前端会自动检测不到后端，退回本地模式（`content.json` 那套逻辑还在）


---

## 十一、方案 B：复用已有的 Worker

代码已经备好：`worker/index.ts` 和 `wrangler.jsonc`。

### 1. 改配置

打开 `wrangler.jsonc`，把 `database_id` 换成你的：

```jsonc
"database_id": "REPLACE_WITH_YOUR_DATABASE_ID"
```

### 2. 本地验证

```bash
pnpm build                       # 先出 dist/
npx wrangler dev                 # 本地跑 Worker，接口和页面一起
```

### 3. 设管理员口令

```bash
npx wrangler secret put ADMIN_CODE
# 粘贴你自己的一串，回车
```

### 4. 部署

```bash
pnpm build
npx wrangler deploy
```

部署完访问 `https://<你的worker域名>/`。第一次进 `/login?mode=admin` 用 `ADMIN_CODE` 激活。

### 5. 想自动部署？

控制台 → Workers & Pages → 选 yacc → Settings → Builds → 连 Git

| 配置 | 值 |
| --- | --- |
| Build command | `pnpm build` |
| Deploy command | `npx wrangler deploy` |

（Cloudflare 会自动注入 API token，不需要你手动配）

### 6. 建表

同样不用管，第一次请求自动建。想手动执行：

```bash
npx wrangler d1 execute yacc --remote --file=server/schema.sql
```

### 从方案 B 退回方案 A

删掉 `wrangler.jsonc` 和 `worker/` 目录，按方案 A 重新建 Pages 项目即可。
两边的数据库是同一个，数据不会丢。
