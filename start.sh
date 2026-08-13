#!/usr/bin/env bash
# 适用于「裸 Linux 服务器（VPS）」的一键部署脚本（无 Docker 时）。
# 用法：把整个项目传到服务器后，执行 bash start.sh
set -e
export PATH="$PWD/node_modules/.bin:$PATH"

echo "==> 安装依赖"
npm install --legacy-peer-deps
npm rebuild better-sqlite3 || true

echo "==> 构建前端"
npm run build

echo "==> 用 pm2 守护启动（崩溃/开机自动拉起，不会断链）"
npm install -g pm2 >/dev/null 2>&1 || true
pm2 delete agent-chat 2>/dev/null || true
pm2 start "npm run server" --name agent-chat
pm2 save
pm2 startup >/dev/null 2>&1 || true

echo ""
echo "✅ 完成！浏览器访问 http://<服务器IP或域名>:3000 即可使用"
echo "   知识库/聊天记录保存在服务器本地，重启不丢。"
