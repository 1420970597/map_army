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
