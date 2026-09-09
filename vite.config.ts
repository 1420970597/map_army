// 注意：此处必须从 vitest/config 导入 defineConfig，
// 否则 `test` 字段无法通过 vite 自身 UserConfigExport 的类型校验。
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/**
 * Vite 构建配置。
 *
 * 与原站一致，本应用是纯前端单页应用（SPA），全部数据保存在浏览器本地，
 * 不依赖任何后端接口；因此构建产物可以直接托管到任意静态服务器。
 */
export default defineConfig({
  plugins: [react()],
  define: { CESIUM_BASE_URL: JSON.stringify('/cesium/') },
  resolve: {
    alias: {
      // 路径别名，与 tsconfig.app.json 中的 paths 保持同步
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:3001' },
    host: true,
    open: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // 地图类应用依赖体积较大，适当放宽单文件告警阈值
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // 地图库体积远大于应用代码且几乎不变，单独分包可显著提升缓存命中率。
        // 暂不对导出库分包：导入导出功能落地前它们不会进入依赖图，
        // 强行声明只会产生空的 chunk。
        manualChunks: {
          leaflet: ['leaflet', 'react-leaflet'],
        },
      },
    },
  },
  test: {
    // 单测使用 node 环境；涉及 DOM 的用例在文件头部自行声明 jsdom
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    globals: true,
  },
});
