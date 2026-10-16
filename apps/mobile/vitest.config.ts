import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

/**
 * 前端测试基线（vitest），刻意与 vite.config.ts 独立：
 * uni 构建链（@dcloudio/vite-plugin-uni）对配置与条件编译敏感，
 * 测试只走标准 @vitejs/plugin-vue 转 SFC，不加载 uni 插件。
 */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "happy-dom",
    include: ["src/**/*.{spec,test}.ts"],
  },
});
