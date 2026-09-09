/** 拷贝 Cesium 运行所需的静态资源，离线构建时不依赖远程 CDN。 */
import { cp, mkdir } from 'node:fs/promises';
await mkdir('public/cesium', { recursive: true });
for (const name of ['Assets', 'Workers', 'ThirdParty', 'Widgets']) await cp(`node_modules/cesium/Build/Cesium/${name}`, `public/cesium/${name}`, { recursive: true });
