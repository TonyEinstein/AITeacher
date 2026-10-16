# ===== AI Teacher 后端生产镜像 =====
# 多阶段构建：依赖安装 → 构建 → 运行
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# 先拷贝依赖清单，利用 Docker 层缓存
COPY package*.json ./
COPY prisma ./prisma/

RUN npm config set registry https://registry.npmmirror.com \
    && npm install --legacy-peer-deps

# 拷贝源码并构建
COPY . .
RUN npx prisma generate \
    && npm run build

# ===== 运行阶段 =====
FROM node:22-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

# 安装运行时所需的最小依赖（Prisma 需要 openssl）
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm config set registry https://registry.npmmirror.com \
    && npm install --legacy-peer-deps --omit=dev \
    && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

# 容器启动：等待数据库 → 执行迁移 → 启动服务
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
