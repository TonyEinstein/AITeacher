/**
 * 多环境配置
 * - dev：本地开发（后端默认 3000）
 * - prod：生产环境走同域反向代理 `/api/v1`，或用构建期 VITE_API_BASE 覆盖为正式 HTTPS 域名
 */
function resolveEnv() {
  // 直接写 import.meta.env.X（不要先存成变量）：Vite 只对这种字面量成员访问做
  // 编译期静态替换，进而让下面的三元分支可被 DCE 完全消除、dev 地址不进生产产物。
  const mode = import.meta.env.MODE || 'development'
  const isProd = mode === 'production'
  // 小程序端无「同域」概念，必须由构建期显式注入 VITE_API_BASE；
  // H5 生产缺省走同域 `/api/v1`（由 nginx 反代到后端），避免把固定 IP 打进产物
  const apiBase = import.meta.env.VITE_API_BASE || (isProd ? '/api/v1' : 'http://127.0.0.1:3000/api/v1')
  return { apiBase, mode }
}

export const ENV = resolveEnv();