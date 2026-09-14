# Python 后端部署与数据管理

Python/FastAPI 是唯一持久化 HTTP 服务。MySQL 8.4 保存工作空间、项目、图层、要素、历史修订、分享、偏好、收藏、自定义军标、模型定义、文件引用和转换任务；MinIO 保存原件、GLB、图片、SVG 和导出文件。前端继续负责 Leaflet/Cesium/Three.js 渲染、手势和当前编辑撤销栈，未同步修改另存浏览器缓存。

格式算法继续复用现有 TypeScript 实现，由 Python 在有时间和内存上限的独立 Node 进程中调用。Node 不提供 HTTP 或读写数据库。Blender 在独立 worker 容器中处理 OBJ，HTTP 请求只创建可查询、可重试的任务。见 [架构决策](adr/0001-python-persistence.md) 和 [迁移清单](TODO-python-mysql-s3-backend-2026-09.md)。

## 启动

需要 Docker Engine 与 Compose v2。首次启动：

```bash
python3 scripts/backend-env.py
docker compose up --build -d --wait
curl -f http://localhost:8080/api/health
docker compose ps
```

`.env` 生成随机凭证，权限 0600，重复执行不会覆盖；[环境示例](../.env.example) 列出配置项。API 的健康检查实际查询 MySQL 迁移版本和 S3 桶。`init` 先执行 Alembic、只读旧分享迁移、内置目录种子，成功后 API 和 worker 才启动。

服务为 `map-army`（Nginx）、`api`（Python）、`worker`（Python + Blender）、`mysql`、`s3` 和一次性 `init`。默认网页端口 8080；数据库端口 33080、S3 39000、控制台 39001 仅绑定回环地址。反向代理使用 HTTPS 时设置 `COOKIE_SECURE=true`，浏览器通过同源 `/api` 访问。生产运行所需的 Node、Python 与 Blender 已包含在镜像中。

`mysql-data` 和 `s3-data` 是持久卷。不要执行 `down -v`。`share-data` 默认引用旧 `map_army_share-data` 卷，只读挂载，原 Node 数据不会删除或改写。已有部署若卷名不同，设置 `LEGACY_SHARE_VOLUME`。切换前先停止旧 Node 分享写入，执行最终迁移，再把网页入口切换至新 Nginx；验证期间可设置 `APP_PORT=8088` 和独立 Compose 项目名。

## 本机开发与检查

需要 Node 20.19+、Python 3.13；本机执行 OBJ 转换还需 Blender。Docker worker 自带 Blender。

```bash
npm ci
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
python3 scripts/backend-env.py
docker compose -p map_army_dev -f compose.infra.yml up -d --wait
npm run backend:tool
.venv/bin/python -m alembic -c backend/alembic.ini upgrade head
.venv/bin/python -m backend.app.seed
npm run server
```

另开终端运行 `npm run backend:worker`、`npm run dev`。Vite 的 `/api` 代理到 `127.0.0.1:30881`。`npm run ci` 包括 ESLint、Prettier、模型校验、全部 Vitest、真实 MySQL/MinIO API 测试、备份恢复测试、旧 Node 分享契约回归和生产构建。测试用独立随机工作空间；备份恢复测试创建并清理临时数据库，需要 `.env` 中的 MySQL root 凭证，不清空应用数据。

完整容器重启验收：

```bash
python3 scripts/backend-smoke.py create --state /tmp/maparmy-smoke.json
docker compose restart api worker mysql s3
docker compose up -d --wait
python3 scripts/backend-smoke.py verify --state /tmp/maparmy-smoke.json
```

验收创建项目、上传 OBJ 并等待真实 worker 转成 GLB，再检查重启后的项目和文件。临时访问码仅写入 0600 文件，验证后自动删除。CI 对 Node 20/22 使用真实 MySQL 与 MinIO；Node 22 另执行完整 Compose 构建与重启验证。

## 页面与数据归属

页面顶部“工作空间”提供项目列表、新建、另存、历史恢复、项目删除、模型库、文件资产和工作空间连接。复制访问码后可在另一浏览器或设备连接同一空间。访问码具有该空间完整读写能力；数据库只存哈希，浏览器 HttpOnly SameSite cookie 用于 API 身份，本地保留可复制访问码。此机制是项目扩展，不是原站 Pro 的账户/角色系统。

旧浏览器会话、偏好、收藏和自定义军标首次幂等迁移；原有会话“恢复/丢弃”选择保留。后端项目随后自动恢复到最近打开的项目。偏好和军标收藏采用不同缓存键。切换空间不把前一个空间的缓存再次当作旧数据导入。

Service Worker 对 `/api` 采用纯网络访问，应用先确认旧 Worker 已升级策略，再建立后端同步；身份和私有文件不会从静态缓存读取。自动保存只提交完成的手势。项目与资料均带版本号，冲突时保留原始待保存副本，不自动覆盖。项目可另存；偏好、收藏和自定义军标可明确选择本地或服务器资料。断网或请求响应丢失时保留草稿和版本；恢复网络后重试。创建自动保存项目使用稳定草稿 ID，响应丢失不会生成重复项目。撤销栈留在当前浏览器，服务器修订历史可以恢复为新的项目版本。

分享使用原三种链接语义、随机 ID、独立编辑令牌与版本。固定分享的图片只按该分享版本引用授权；复制固定分享时保留该版本及其资产引用。把分享另存项目后，资产引用随独立项目保留，原资产不能因删除破坏历史。普通外部标图不会被误报为当前私有项目已保存，需更新分享或另存项目。

## API 与文件

交互式文档：`/api/docs`；完整契约：`/api/openapi.json`。错误形状为 `{ "error": "说明" }`，参数校验可附 `fields`。常见状态：401 无工作空间、403 无资源权限、404 不存在、409 版本冲突/仍被引用、413 大小限制、422 内容无效、428 缺少 If-Match、503 依赖不可用。

| 接口 | 用途 |
| --- | --- |
| `POST /api/workspaces`、`GET /api/workspace`、`POST /api/workspace/connect` | 创建、读取、连接工作空间 |
| `GET/PUT /api/workspace/settings`、`POST /api/workspace/migrate` | 资料和浏览器迁移 |
| `/api/projects`、`/api/projects/{id}` | 项目列表、创建、读取、版本保存、软删除 |
| `GET /api/projects/{id}/versions`、`POST .../versions/{revision}/restore` | 不可变版本与恢复 |
| `/api/shares/{id}`、`POST .../copy` | 原分享兼容接口 |
| `POST/GET /api/assets`、`GET .../{id}/content`、`DELETE .../{id}` | 文件及引用保护 |
| `GET /api/catalog`、`GET /api/models` | 内置军标、AFSIM 索引、版本化模型目录 |
| `POST/GET /api/model-imports`、`POST .../{id}/retry` | 模型导入队列 |
| `PUT /api/models/{id}/metadata` | 新模型资料/挂载兼容版本 |
| `POST /api/exchange/import`、`/afsim`、`/export` | 服务器格式处理与原件、产物留存 |

私有工作空间接口默认使用 cookie，自动化调用也可用 `X-Workspace-Token`。分享覆盖使用原 `Authorization: Bearer` 编辑令牌。项目更新、删除、恢复与资料更新必须携带 `If-Match`。POST 创建可携带 32 位十六进制 `clientId` 保证重试幂等。项目 PUT 的 `unlockedLayerIds` 表示本次编辑过程中明确发生的解锁操作，使解锁、编辑和重新锁定可合并在一个保存事务中。

单文件默认 64 MiB、文档/JSON 32 MiB，Nginx 请求上限 65 MiB。S3 桶不直接公开；资产接口检查归属和项目/分享版本引用。JSON/GeoJSON 导出把内部图片还原为内嵌图像以便跨空间导入。GLB 模型引用按 ID 与版本保存，交换文件本身不会打包私有三维模型；跨部署迁移模型需导入同一资产或恢复备份。

## 自定义模型与挂载

在“工作空间 → 模型库”添加自包含 GLB 或 OBJ。GLB 经 glTF Validator 校验；不接受外链缓冲或贴图。当前预览未启用 Draco/Meshopt/KTX2 解码，导入会明确拒绝这类压缩资源，请从建模工具导出未压缩的自包含 GLB。OBJ 只保留几何指令，材质请使用自包含 GLB。任务成功后模型立即进入详情页的可选目录；类型可在模型资料中修改，保存资料会生成新版本，旧项目保留原引用。

Blender 的 Empty 节点导出时启用 Custom Properties：挂点使用 `mapArmyNodeRole=attachmentSocket` 和唯一 `socketId`，部件安装锚点使用 `mapArmyNodeRole=attachmentAnchor`，每个部件最多一个锚点。上传后挂点自动识别，在模型资料中勾选各挂点允许的部件。详情页支持拖放、点击安装、拆卸、撤销、只读旋转和按模型实际大小自动取景。这是可视化装配，不计算真实载荷或运动性能。

已有可发布内置模型由种子写入 S3；34 个 Mover Creator AMC 模板的完整几何转换仍见[专项评估](RESEARCH-mover-creator-backend-2026-09.md)，本次后端迁移不把 OSGB 索引等同于 AMC 支持。

## 备份、恢复、升级

执行备份时保持 GC 停止；MySQL 使用一致性事务快照，S3 对象不可变且逐一校验 SHA-256。备份包含访问码哈希和所有工作空间数据，应按私有数据保管。导出到容器外的目录：

```bash
mkdir -p backups
docker compose run --rm --no-deps --user 0 -v "$PWD/backups:/backups" api python -m backend.app.manage backup /backups/maparmy.tar.gz
```

同名备份不会覆盖。恢复只允许已执行 Alembic、尚未 seed 的空数据库；拒绝覆盖现有部署。用独立 Compose 项目名、不同端口启动 MySQL 和 S3 后执行：

```bash
MYSQL_PORT=33180 S3_PORT=39100 S3_CONSOLE_PORT=39101 docker compose -p map_army_restore up -d mysql s3 --wait
docker compose -p map_army_restore run --rm --no-deps api python -m alembic -c backend/alembic.ini upgrade head
docker compose -p map_army_restore run --rm --no-deps -v "$PWD/backups:/backups:ro" api python -m backend.app.manage restore /backups/maparmy.tar.gz
```

先核对恢复数据，再配置网页端口并启动其余服务。迁移固定在 Alembic 版本文件，不动态调用当前模型创建旧结构。初始迁移拒绝破坏性 downgrade；回退采用先前镜像和经验证的独立备份。

`python -m backend.app.manage gc` 仅预览超过一天且无数据库资产记录的 S3 孤立对象；`--apply` 才删除。项目与历史引用的文件不会进入此列表。备份或恢复期间不要执行 GC。
