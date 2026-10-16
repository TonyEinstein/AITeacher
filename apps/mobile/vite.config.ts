import { defineConfig, type Plugin } from "vite";
import uni from "@dcloudio/vite-plugin-uni";

/**
 * favicon 兜底：浏览器默认请求根路径 /favicon.ico，而 uni-app H5 的静态目录
 * 是 src/static（dev 下挂 /static/ 前缀）。此插件把根路径请求重定向到
 * /static/favicon.ico，消除 404；构建产物里 index.html 的 <link rel="icon">
 * 已指向 /favicon.ico（由 index.html 模板声明），H5 部署时由静态服务器按同样
 * 规则（favicon 放站点根）提供即可。
 */
function faviconRedirect(): Plugin {
  return {
    name: "favicon-redirect",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url === "/favicon.ico") req.url = "/static/favicon.ico";
        next();
      });
    },
    // 预览服务器（vite preview）同样处理
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url === "/favicon.ico") req.url = "/static/favicon.ico";
        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [uni(), faviconRedirect()],
  server: {
    // 固定 5175：与 scripts/start-all.ps1 的后端就绪探测、以及
    // apps/desktop（Tauri）的 devUrl 保持一致（uni-app 默认 5173 会与旧 admin-web 端口语义混淆）。
    port: 5175,
    strictPort: true,
  },
});
