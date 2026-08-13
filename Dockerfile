# 多阶段构建：构建阶段编译前端+安装依赖，运行阶段只保留运行所需
FROM node:22-bookworm AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build
# 备份初始知识库与数据库，供容器首次挂载空卷时填充（避免部署后知识库丢失）
RUN cp -r knowledge-base knowledge-base.default 2>/dev/null || true
RUN cp -r data data.default 2>/dev/null || true

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
# 直接复用构建阶段产物（含 better-sqlite3 原生模块，同 Debian/glibc 可运行）
COPY --from=build /app /app
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["/app/node_modules/.bin/tsx", "server/index.ts"]
