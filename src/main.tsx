/**
 * 应用入口。
 *
 * 导入顺序有讲究：Leaflet 的样式必须先于自定义样式加载，
 * 否则自定义样式中对 Leaflet 类名的覆盖会被反向覆盖。
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';

import { App } from './App';
import './styles/global.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('未找到挂载节点 #root，请检查 index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/**
 * 注册 Service Worker，赋予应用离线运行与安装能力。
 *
 * 仅在生产环境注册：开发环境下 SW 的磁盘缓存会干扰
 * Vite 的模块热更新，导致改动不生效，得不偿失。
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // BASE_URL 使部署到任意子路径时注册地址仍正确。
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' })
      .then((registration) => {
        const notifyUpdate = () => {
          window.dispatchEvent(new CustomEvent('map-army:update-available'));
        };
        if (registration.waiting) notifyUpdate();
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) notifyUpdate();
          });
        });
      })
      .catch((error) => {
        // 注册失败不影响应用本身的功能，仅失去离线能力。
        console.warn('[PWA] Service Worker 注册失败，应用将以在线模式运行：', error);
      });
  });
}
