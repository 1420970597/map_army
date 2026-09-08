# 批次 2（战术图形与符号库）主理人决策拍板

> 依据：`docs/ARCH-tactical-graphics.md`（架构师高见远，1116 行）、`docs/PRD-roadmap-gap.md`、`docs/ARCH-geo-edit.md`
> 批次分支：`feature-tactical-graphics`
> 状态：**已拍板，作为实现强制约束**

## 一、四个决策点的裁定

### D1 战术图形不新增 `GeometryKind` —— **批准**

多点符号复用现有 `Line` / `Area` 几何，通过 `MapFeature` 上三个**可选**字段描述：

- `symbolKind`：区分普通符号与战术图形
- `graphicType`：战术图形类型（进攻箭头、防御箭头、集结地域、分界线、走廊、相位线等）
- `graphicParams`：翼展、宽度等可调参数

`geometry.points` 即**控制点**；渲染时由几何生成器展开为实际绘制形状。

**理由**：批次 1 的顶点编辑、吸附、多选、撤销框架**零改动**，风险最低；与 `ARCH-geo-edit.md` §1.2 演进表一致。

### D2 新增 `useSymbolStore` —— **批准**（修正原总表表述）

收藏夹与符号格式默认值属于**可持久化偏好**，不是瞬时视图状态，因此独立建 store。

**理由**：
1. 需落 localStorage，独立 store 便于持久化与单测；
2. 避免 `useViewStore` 继续膨胀；
3. 与 `useEditStore`（瞬态）、`useSessionStore`（会话）职责边界清晰。

**附带修正**：`ARCH-geo-edit.md` 总表中"批次 2 不新增 store"的表述与此冲突，以本文件为准，实现时同步更新该表述。

### D3 战术图形 SIDC 采用内部编码，外系统映射留到批次 5 —— **批准**

采用"符号集 25 + 本库内部实体段"的内部编码方案，与外系统（MilX 等）的映射表留到 R54（批次 5）统一处理。

**理由**：先落地能力，避免在缺少权威编码表时阻塞；后续若有标准编码表可直接替换。

### D4 几何在局部米制平面生成，与缩放级别解耦 —— **批准**

新增 `core/geo/planar.ts`，`buildGraphic(type, controlPoints, params?)` 在**局部米制平面**计算，不注入 `Projection`、不碰像素。

**理由**：结果与缩放级别无关，保证批次 4 导出、批次 5 交换时形状一致；完全符合批次 1 §1.3 已定契约。

## 二、强制实现约束（易漏，违反将导致静默降级）

架构师已标注，本处升级为**强制检查项**：

新增 `MapFeature` 字段时，必须在**三处白名单**同步补齐：

| # | 位置 | 作用 |
|---|---|---|
| 1 | `src/core/model/factory.ts` → `cloneFeature` | 要素复制（如复制粘贴） |
| 2 | `src/core/model/clipboard.ts` → `cloneFeature`（**独立于 factory，易漏**） | 剪贴板载荷深拷贝 |
| 3 | `src/core/io/milxly.ts` → `reviveFeature`（白名单重建） | 保存/读取往返 |

**后果**：任一处遗漏，都会出现"复制或保存后箭头退化为普通折线"的静默降级，且现有测试未必覆盖到。

要求：工程师每新增一个 `MapFeature` 字段，必须在自检清单中逐项确认上述三处已同步，并补充对应的往返测试。

## 三、规模与节奏

- 新增 38 个文件（源码 23 + 单测 15），修改 22 个，任务 T01–T28
- **零新增依赖**
- core 纯函数与单测必须排在对应 UI 之前
- 每完成一个可验证单元即提交，及时推送到远程分支并更新草稿 PR
