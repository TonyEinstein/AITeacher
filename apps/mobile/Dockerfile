# ===== uni-app H5 构建 =====
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm config set registry https://registry.npmmirror.com \
    && npm install --legacy-peer-deps
COPY . .
# 构建期注入后端 API 地址（生产默认同域 /api/v1，由部署环境覆盖）
ARG VITE_API_BASE=/api/v1
ENV VITE_API_BASE=$VITE_API_BASE
RUN npm run build:h5

# ===== Nginx 托管静态资源 =====
FROM nginx:1.27-alpine
COPY --from=builder /app/dist/build/h5 /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
