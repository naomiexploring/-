#!/usr/bin/env bash
set -e
# 若挂载卷为空，用镜像内初始知识库/数据库填充，避免部署后知识库与历史丢失
if [ -d /app/knowledge-base.default ] && [ -z "$(ls -A /app/knowledge-base 2>/dev/null)" ]; then
  cp -r /app/knowledge-base.default/. /app/knowledge-base/
fi
if [ -d /app/data.default ] && [ -z "$(ls -A /app/data 2>/dev/null)" ]; then
  cp -r /app/data.default/. /app/data/
fi
exec "$@"
