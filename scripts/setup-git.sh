#!/usr/bin/env bash
# 一次性把本地仓库接到 GitHub。
#
# 用法：
#   ./scripts/setup-git.sh <仓库地址>              # 自动用 <用户名>@users.noreply.github.com
#   ./scripts/setup-git.sh <仓库地址> <邮箱> [名字]  # 手动指定邮箱
#
# 前提：GitHub 上已建好仓库。远程 main 如果已有内容，需要 FORCE=1 才会覆盖。

set -euo pipefail

REPO_URL="${1:-}"
EMAIL_ARG="${2:-}"
NAME="${3:-yacc}"

if [ -z "$REPO_URL" ]; then
  echo "用法：$0 <仓库地址> [邮箱] [名字]"
  echo "例如：$0 git@github.com:someone/yacc.git"
  exit 1
fi

cd "$(dirname "$0")/.."

# 从地址里取 owner：兼容 git@github.com:owner/repo.git 和 https://github.com/owner/repo.git
OWNER=$(printf '%s' "$REPO_URL" \
  | sed -E 's#^git@[^:]+:##; s#^https?://[^/]+/##' \
  | cut -d/ -f1)

if [ -z "$OWNER" ]; then
  echo "看不懂这个地址：$REPO_URL"
  exit 1
fi

EMAIL="${EMAIL_ARG:-${OWNER}@users.noreply.github.com}"

echo "仓库    $REPO_URL"
echo "提交者  $NAME <$EMAIL>"
echo

echo "→ 设置提交身份"
git config user.name "$NAME"
git config user.email "$EMAIL"

if git remote get-url origin >/dev/null 2>&1; then
  echo "→ 更新 origin"
  git remote set-url origin "$REPO_URL"
else
  echo "→ 添加 origin"
  git remote add origin "$REPO_URL"
fi

if git rev-parse --verify HEAD >/dev/null 2>&1; then
  echo "→ 已有提交，跳过首次提交"
else
  echo "→ 创建第一次提交"
  git add -A
  git commit -m "yacc v1：离线版 + 在线化（账号 / 密钥 / 评论 / 点赞）"
fi

if git ls-remote --heads origin main 2>/dev/null | grep -q .; then
  echo
  echo "⚠️  远程 main 已经有内容了。"
  if [ "${FORCE:-0}" = "1" ]; then
    echo "→ FORCE=1，覆盖远程 main"
    git push -f -u origin main
  else
    echo "   如果确认要用本地覆盖远程，重跑："
    echo "   FORCE=1 $0 $REPO_URL"
    exit 1
  fi
else
  echo "→ 推送到 main"
  git push -u origin main
fi

echo
echo "完成。接下来去 Cloudflare："
echo "  1. Workers & Pages → Create → Pages → Connect to Git → 选这个仓库"
echo "  2. Build command: pnpm build"
echo "  3. Build output directory: dist"
echo "  4. Settings → Functions → D1 database bindings → 变量名 DB → 选你的 yacc 库"
echo "  5. Settings → Variables and Secrets → ADMIN_CODE（类型选 Secret）"
echo "  6. 重新部署，然后访问 /login?mode=admin"
