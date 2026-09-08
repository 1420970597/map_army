# QA 独立验证报告：批次 1（几何编辑与多选）

| 项          | 内容                                                                                                     |
| ----------- | -------------------------------------------------------------------------------------------------------- |
| 验证人      | 严过关（Yan，QA）                                                                                        |
| 分支 / HEAD | `feature-geo-edit` / `944c296`                                                                           |
| 验证范围    | `docs/ARCH-geo-edit.md` 的 T14–T26（多选、顶点编辑、吸附、手势事务、剪贴板、快捷键、会话、图层、检查器） |
| 验证性质    | 独立复验 + 补强测试；**未修改任何非测试源码**                                                            |
| 结论        | **建议合并 PR #19**，但 **BUG-01 建议随本 PR 一并修复**（改动约 3 行、风险低）；其余缺陷可拆独立 issue   |

---

## 1. 基线结果（QA 复跑，真实数字）

| 命令                                           | 结果                                               | 说明                               |
| ---------------------------------------------- | -------------------------------------------------- | ---------------------------------- |
| `npx tsc -b`                                   | 通过（exit 0）                                     | 补强测试后仍通过                   |
| `npx vitest run`                               | 基线 **38 文件 / 673 用例** 全绿                   | 补强后 **44 文件 / 754 用例** 全绿 |
| `npx eslint .`                                 | 通过（exit 0，无告警）                             | 补强后仍通过                       |
| `npx prettier --check "src/**/*.{ts,tsx,css}"` | 通过（All matched files use Prettier code style!） | 新增文件已格式化                   |

四条命令在我接手时即为全绿，工程师自验数据属实。

---

## 2. 补强 / 新增用例清单

新增 **6 个测试文件、81 条用例**（命名统一为 `*.qa.test.ts`，与工程师用例并存、互不干扰）：

| 文件                                              | 用例数 | 覆盖的不变量                                                                                                                                                             |
| ------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/stores/useDocumentStore.qa.test.ts`          | 29     | 撤销粒度（顶点拖拽 / 无变化手势 / 滑块 / 批量移动 / 粘贴）、撤销栈上限、`vertexBearings` 平行数组、多选语义（末位 primary / 顺序 / 去重 / 缺失过滤）、隐藏与锁定图层边界 |
| `src/core/geo/snap.qa.test.ts`                    | 13     | 三源同距优先级、更近的低优先级胜出、阈值闭区间、阈值 0、关闭恒 null、按投影像素比较、排除自身顶点                                                                        |
| `src/core/model/clipboard.qa.test.ts`             | 12     | 载荷与文档双向隔离（逐层引用断言）、连续粘贴偏移 24/48/72/96、非法 `pasteCount` 归一、结构非法拒收不抛、自动方向占位往返                                                 |
| `src/core/shell/shortcuts.qa.test.ts`             | 9      | `isTypingTarget` 的标签 / `contentEditable` / 祖先回溯判定、命令执行副作用边界、未知命令不消费                                                                           |
| `src/features/shell/keyboardExemption.qa.test.ts` | 9      | 键盘事件 → 豁免判定 → 命令执行的端到端链路（输入框内 S / Z / Delete / Ctrl+Z 不触发，Escape 仍触发）                                                                     |
| `src/features/shell/sessionRestore.qa.test.ts`    | 9      | 读取 → 恢复候选 → 用户确认 → 写入文档的端到端链路；corrupt 不崩溃                                                                                                        |

### 2.1 与既有用例的关键差异（为什么需要补）

1. **撤销粒度从"长度"升级为"完全相等"**：既有用例断言 `past` 长度为 1；新增用例进一步断言一次 `undo` 后**整份文档要素深相等**回到手势前，避免"提交了一条但快照内容错"的假绿。
2. **批量移动按真实规模验证**：既有用例标题写"批量移动五个要素"，实际只移动了 2 个（其余已在目标层或不存在）。新增用例用 5 个真实分布在不同图层的要素验证。
3. **同距优先级用勾股数坐标**：三角函数生成的"同距"候选在浮点下并不严格相等，会让优先级断言假失败/假通过；新用例统一用 `(5,0) / (3,4) / (4,3)` 等整数勾股数，保证 `distanceSq` 精确相等。
4. **会话恢复串成一条链**：既有用例分别在持久化层（`loadDocumentResult`）与状态容器层（`useSessionStore`）验证，中间"读取结果 → 恢复候选 → 写入文档"没有端到端约束——一旦有人改成自动覆盖，既有单测仍会全绿。
5. **输入框豁免真正执行了一次**：既有 `isTypingTarget` 只在 Node 环境（`HTMLElement === undefined`）被验证，等于这条需求从未被执行过。新用例注入最小 DOM 替身，真实走通 `instanceof` 判定与祖先回溯。

---

## 3. 已确认的源码缺陷（`Source Bug`）

> 以下缺陷均以 `it.fails` 用例锁定在 `src/stores/useDocumentStore.qa.test.ts`。
> `it.fails` 语义：断言**当前应当失败**；工程师修好后该用例会转为失败并提示 "Expected test to fail"，届时请把它改回普通 `it`，即可成为永久回归防线。

### BUG-01【中】拖拽任一顶点会清空该要素的全部手动顶点方向

- **位置**：`src/stores/useDocumentStore.ts:475`（`previewFeatureGeometry`）
  ```ts
  vertexBearings: bearings ? [...bearings] : undefined,
  ```
- **链路**：`VertexEditor.tsx:152` 松手时调用 `applyGeometry(id, pointsRef.current)`，**从不传 bearings** → `previewFeatureGeometry` 把 `undefined` 当成"清空整个方向字段"。
- **实测**：`vertexBearings: [45, 90, 135]` 的线要素，拖动第 2 个顶点后 `vertexBearings === undefined`（已用临时脚本实测确认，非测试写错导致的假失败）。
- **语义冲突**：同一个 `undefined` 在 `isValidGeometryUpdate`（:196）里被解释为"调用方不改动方向，跳过长度校验"，在预览里却被解释为"清除全部方向"。
- **触发路径**：导入带手动方向的 `.milxly`（`core/io/milxly.ts:161` 会还原 `vertexBearings`）后拖拽顶点——批次 1 的 UI 只提供"重置方向"，没有设置入口，因此触发频率不高，但属于**静默数据丢失**，且会额外产生一条撤销历史。
- **建议修复**：`previewFeatureGeometry` 中仅在显式传入 `bearings` 时覆盖，否则保留 `feature.vertexBearings`；需要清空时走已有的 `resetVertexBearing(id, 'all')`。同时建议让 `applyGeometry` 的 `bearings` 参数语义单一化（三态：`undefined` = 不改动 / 数组 = 覆盖 / 显式 `'reset'` = 清空）。

### BUG-02【中】`removeFeatures` 无条件提交历史，产生"空撤销"

- **位置**：`src/stores/useDocumentStore.ts:260-267`
- **实测**：`removeFeatures(['missing'])` 后 `past.length === 1`，文档要素数不变 → 用户按一次 `Ctrl+Z` 什么都没发生。
- **冲突**：与批次 1 明确建立的"无变化手势 = 0 条历史"语义不一致（`moveFeaturesToLayer` / `setLayerStatus` / `applyGeometry` 都做了无变化判断，唯独 `removeFeatures` 没有）。
- **建议修复**：先算出实际会被删除的要素集合，为空则 `return state`。

### BUG-03【中】框选会命中隐藏图层上的要素

- **位置**：`src/stores/useDocumentStore.ts:541`（`selectInBounds`）+ `src/features/map/BoxSelect.tsx:76`
- **不一致**：`FeatureLayer` 只渲染可见图层要素，因此**单击选不中**隐藏要素；但框选直接用全量 `document.features` 做命中判定，**框选却能选中**。用户看不见却已被选中，随后的 `Delete`、批量移动、检查器批量改属性都会静默作用于不可见要素。
- **建议修复**：`selectInBounds` / `BoxSelect` 命中判定前按图层 `visible` 过滤（可与 `MapView.orderedFeatures` 复用同一份可见要素）。是否同时排除锁定图层建议由产品确认（见 OBS-1）。

### BUG-04【中】吸附三源中的 `grid` 源未实现

- **位置**：`src/features/draw/vertexEditorLogic.ts:85`（注释已说明待 `GridOverlay` 提供交点数据）、`src/features/draw/drawSnapLogic.ts`（无 grid 分支）
- **依据**：`docs/ARCH-geo-edit.md:458` 明确定义三源 `self` / `feature` / `grid`，`:460` 规定同距优先级 `self > feature > grid`；`docs/SMOKE-TEST-geo-edit.md` 第 3 步要求"拖动顶点靠近另一要素顶点与网格交点，观察吸附指示"。
- **影响**：`snap.ts` 引擎本身支持 grid（`SOURCE_PRIORITY` 已定义），但没有任何候选生成器产出 grid 候选 → 网格吸附在 UI 上完全不可用，冒烟清单第 3 步无法完成。属于**功能缺失**（非回归）。
- **建议**：若确认为批次 1 范围外，请在 ARCH/冒烟清单中显式标注"grid 源顺延至批次 X"并临时调整冒烟步骤；否则补齐 `GridOverlay` 交点接口。

### BUG-05【低】吸附阈值与开关未持久化，缺少 `map-army.prefs.v1`

- **依据**：`docs/ARCH-geo-edit.md:1104` 列出三个 localStorage 键，其中 `map-army.prefs.v1`（吸附阈值与开关）在代码中不存在（全仓 `localStorage` 仅出现在 `persistence.ts` 与 `useClipboardStore.ts`）。
- **影响**：`useEditStore.snapEnabled` / `snapThresholdPx` 每次刷新回到默认值。

### BUG-06【低】主选要素三处实现不一致

- `selectPrimaryFeature`（`useDocumentStore.ts:600`）：只取队列末位，末位 id 缺失时返回 `null`，与其自身 JSDoc「末位**仍存在**的主选要素」不符；
- `deriveInspectorSelection`（`inspectorLogic.ts`）：先过滤缺失项再取末位，行为更健壮；
- `MapView.tsx:146`：内联重复实现了第一份逻辑。
- 三者目前结果一致（因为 `selectedIds` 一般不含缺失 id），但属于隐患；`selectPrimaryFeature` / `usePrimaryFeature` / `useSelectedFeatures` 目前**无生产调用方**（仅被测试引用）。
- **建议**：收敛为单一 selector 并在 `MapView` 复用。

---

## 4. 测试问题（`Test Issue`，QA 已修）

| 编号 | 问题                                                                                                            | 处理                                                                                     |
| ---- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| TI-1 | `isTypingTarget` 只在 Node 环境（`HTMLElement === undefined`）验证，"输入框豁免"从未真正执行过                  | 新增 `shortcuts.qa.test.ts` 与 `keyboardExemption.qa.test.ts`，用最小 DOM 替身端到端跑通 |
| TI-2 | "批量移动五个要素只提交一次"实际只移动 2 个，规模断言名不副实                                                   | 新增真实 5 要素用例（`useDocumentStore.qa.test.ts`）                                     |
| TI-3 | 会话恢复三层链路未串联，"自动覆盖文档"这类改动不会让既有单测变红                                                | 新增 `sessionRestore.qa.test.ts` 端到端用例                                              |
| TI-4 | 撤销粒度只断言 `past` 长度，未校验快照内容                                                                      | 新增"一次 undo 后文档深相等"断言                                                         |
| TI-5 | 同距优先级用例若用三角函数构造坐标，浮点误差会让断言失真                                                        | 改用整数勾股数坐标                                                                       |
| TI-6 | QA 自身失误：`it.failing` 在本仓库 vitest 3.2 不存在（正确 API 为 `it.fails`）；两个多选用例因 TDZ 引用自身报错 | 均已修正并复跑通过（如实记录）                                                           |

> 说明：`useSessionStore.test.ts:89` 的 `expect(...).not.toThrow()` 后紧跟 `toMatchObject` 状态断言，强度足够，**不算**弱用例。

---

## 5. 观察项（`OBS`，不阻塞合并，建议记入 backlog）

| 编号  | 观察                                                                                                                                                                                                                | 建议                                                         |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| OBS-1 | 锁定图层上的要素仍可被 `Delete` / 检查器删除（`removeFeatures` 不过滤 `locked`）；顶点编辑与"移入锁定图层"已正确拒绝                                                                                                | 需求未明确，请产品确认"锁定"是否应禁止删除                   |
| OBS-2 | `buildVertexSnapCandidates` 额外排除了**同图层**的其他要素（`vertexEditorLogic.ts:113`），而 ARCH D5 只要求"可见且未锁定"                                                                                           | 与文档口径不一致，且减少了可用吸附目标；若为刻意优化请补注释 |
| OBS-3 | `core/model/spatialIndex.ts` 已实现且有 13 条测试，但生产代码零引用；候选构建**无视口裁剪**（ARCH 风险 5 要求"视口裁剪 + 分桶"），`MAX_SNAP_CANDIDATES = 2000` 在中等文档上就可能触发静默降级（远端候选被直接截断） | 批次 7 性能优化时一并接线                                    |
| OBS-4 | 帮助面板在 macOS 仍显示 `Ctrl+Z`（不显示 ⌘），且面板内的 Escape 监听会与全局 `edit.escape` 命令同时触发                                                                                                             | 体验优化，可顺延                                             |
| OBS-5 | `symbology/frames.test.ts:291` 仅断言 `symbolToSvg(sidc)` 不抛错，未校验产物                                                                                                                                        | 批次 1 范围外的历史用例，建议另开技术债                      |

---

## 6. 通过项（`NoOne` / 验证通过的高风险不变量）

| 不变量                                                                                                    | 结论                                            |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 一次顶点拖拽 = 1 条历史（12 帧预览实测）                                                                  | ✅ 通过，且一次 undo 精确还原                   |
| 无变化手势 = 0 条历史且不清空 `future`                                                                    | ✅ 通过                                         |
| 不透明度滑块一次拖动 = 1 条历史                                                                           | ✅ 通过（6 次预览 → 1 条，undo 回到 1）         |
| 一次手势内预览多个要素 = 1 条历史                                                                         | ✅ 通过                                         |
| 批量移动 5 个要素 = 1 条历史                                                                              | ✅ 通过（选择按请求顺序，undo 全部回退）        |
| 粘贴 3 个要素 = 1 条历史                                                                                  | ✅ 通过；连续三次粘贴各 1 条                    |
| 撤销栈上限 100 且超限时丢弃最旧快照                                                                       | ✅ 通过（105 次改名后 `past[0]` 为第 5 次快照） |
| `undo` / `redo` 清空当前选择                                                                              | ✅ 通过                                         |
| 多选：末位 primary、顺序稳定、去重、缺失过滤、不入历史                                                    | ✅ 通过                                         |
| 吸附：同距 `self > feature > grid`；更近的低优先级来源胜出；候选顺序无关                                  | ✅ 通过                                         |
| 吸附：阈值闭区间（= 阈值命中，略超不命中）；阈值 0 仅精确重合命中                                         | ✅ 通过                                         |
| 吸附：关闭时对零距离候选恒 `null`；按投影像素而非经纬度差值比较                                           | ✅ 通过                                         |
| 吸附：排除自身顶点、不误排除同下标异要素、不误排除同要素其他顶点                                          | ✅ 通过                                         |
| 剪贴板：载荷 ↔ 文档 ↔ 实例三者双向隔离（逐层引用断言）                                                    | ✅ 通过                                         |
| 剪贴板：连续粘贴偏移 24 / 48 / 72 / 96 线性递增；线要素整体平移不累积                                     | ✅ 通过                                         |
| 剪贴板：`pasteCount` 为 `undefined` / `0` / 负数 / `NaN` 时归一为 1                                       | ✅ 通过                                         |
| 剪贴板：结构非法载荷拒收不抛；损坏内容标记 `corrupt` 且 `localStorage` 异常分类为 `quota` / `unavailable` | ✅ 通过（工程师用例已覆盖，本轮复核）           |
| 剪贴板：不劫持系统剪贴板（全仓无 `navigator.clipboard` / `execCommand`）                                  | ✅ 通过（人工核查）                             |
| 会话：加载**不自动覆盖**当前文档；拒绝恢复后文档原样；接受恢复后一次 undo 可回退                          | ✅ 通过（端到端）                               |
| 会话：corrupt 会话备份原文、清理主键、返回错误而不崩溃                                                    | ✅ 通过                                         |
| 快捷键：输入框内 S / Z / Delete / Ctrl+Z 均不触发；Escape 因 `allowInInput` 仍触发                        | ✅ 通过（端到端）                               |
| 快捷键：未知按键、额外修饰键不消费；未知命令 id 返回 `false` 且不触碰上下文                               | ✅ 通过                                         |
| 快捷键：帮助面板直接消费 `SHORTCUTS` 注册表，无重复声明                                                   | ✅ 通过（人工核查）                             |
| 边界：线 < 2 点、面 < 3 点拒绝写入/删除；方向数组与点数长度失配被拒                                       | ✅ 通过                                         |
| 边界：锁定目标图层拒绝批量移动；锁定/隐藏图层不可进入顶点编辑；id 冲突被过滤                              | ✅ 通过                                         |
| 边界：顶点插入/删除时方向数组与点数等长且索引对齐                                                         | ✅ 通过                                         |

---

## 7. 合并建议

**建议合并 PR #19**，理由：

1. 四项质量命令全绿，754 条用例（含我新增的 81 条）全部通过；
2. 6 项缺陷中没有阻断性问题——BUG-01 的数据丢失可通过一次 `undo` 恢复，且触发路径依赖导入带手动方向的 `.milxly`；BUG-02/03/05 属于一致性/持久化偏差；BUG-04/06 属于范围与收敛问题。

**但请优先处理**：

- **BUG-01 强烈建议随本 PR 修复**（`useDocumentStore.ts:475` 一处判断，约 3 行 + 1 个用例由 `it.fails` 改回 `it`）。它是唯一的静默数据丢失项，且修复成本极低。
- BUG-02、BUG-03 建议合并后立即开 issue（均属"无变化/不可见对象被误操作"家族，改动局部）。
- BUG-04、BUG-05 属于范围确认问题：请架构/产品确认"grid 吸附源"与"`map-army.prefs.v1` 持久化"是否属于批次 1，若否请同步修订 `ARCH-geo-edit.md` 与 `SMOKE-TEST-geo-edit.md`，避免文档与实现长期背离。

---

## 附：本轮 QA 改动文件

```
新增 src/stores/useDocumentStore.qa.test.ts            (29 用例，含 4 条 it.fails)
新增 src/core/geo/snap.qa.test.ts                       (13 用例)
新增 src/core/model/clipboard.qa.test.ts                (12 用例)
新增 src/core/shell/shortcuts.qa.test.ts                (9 用例)
新增 src/features/shell/keyboardExemption.qa.test.ts    (9 用例)
新增 src/features/shell/sessionRestore.qa.test.ts       (9 用例)
新增 docs/QA-batch1-report.md
```

未修改任何非测试源码。
