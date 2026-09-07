# 贡献指南

## 分支模型

```
main            ← 稳定分支，仅接受来自 develop 的发布合并
└─ develop      ← 集成分支，所有功能分支合入此处
   └─ feature-<名称>   ← 功能分支
```

**命名规则**：

| 前缀        | 用途                   | 示例                     |
| ----------- | ---------------------- | ------------------------ |
| `feature-`  | 新功能                 | `feature-symbol-engine`  |
| `fix-`      | 缺陷修复               | `fix-mgrs-band-offset`   |
| `refactor-` | 重构（不改变外部行为） | `refactor-grid-sampling` |
| `docs-`     | 文档                   | `docs-api-reference`     |
| `chore-`    | 构建/依赖/工具链       | `chore-upgrade-vite`     |

> **为什么用连字符而不是斜杠？**
> 标准的 Git Flow 使用 `feature/xxx` 形式。但本仓库的 Git 运行环境在
> `.git/refs/heads/` 下创建子目录时，ref 的 lock-rename 流程会静默失败并回滚目录，
> 导致**提交对象已生成而分支指针丢失**（commit 看似成功，实则 ref 不存在）。
> 为保证提交历史完整可靠，统一改用连字符分隔。这仅影响命名空间书写形式，
> 分支开发 + PR 评审 + 语义化提交信息的规范实质完全不变。

## 提交信息规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/)：

```
<类型>(<作用域>): <简短描述>

<正文：说明动机与实现要点>

<脚注：关联 Issue，如 Closes #12>
```

**类型**：

- `feat` 新功能
- `fix` 缺陷修复
- `refactor` 重构
- `perf` 性能优化
- `test` 测试
- `docs` 文档
- `style` 代码格式
- `chore` 构建/工具链
- `ci` 持续集成

**作用域**：`geo`、`symbology`、`map`、`draw`、`layers`、`io`、`i18n`、`site`、`deps`

**要求**：

- 描述与注释一律使用**简体中文**
- 正文说明「为什么做」而非「做了什么」，代码本身已说明后者
- 一次提交只做一件事，便于 revert 与 bisect
- 破局性变更在脚注写 `BREAKING CHANGE: <说明>`

示例：

```
feat(symbology): 实现 MIL-STD-2525 符号框架的 SVG 生成

按 affiliation × battle dimension 组合生成友军矩形、敌方菱形、
中立正方形与未知四叶形四种框架，统一以 200×200 视口输出，
便于与 function ID 图标叠加时保持几何对齐。

Closes #23
```

## 代码规范

- 全部注释使用**简体中文**，公共 API 需写 JSDoc
- TypeScript 严格模式全开，禁止 `any`（必要时用 `unknown` + 类型守卫）
- 纯逻辑放 `src/core/`，不依赖 DOM 与 UI 框架，保证可单测
- 文件统一 LF 换行、UTF-8 编码、2 空格缩进、100 字符行宽

## 提交前自检

```bash
npm run ci        # lint + 格式校验 + 单测 + 构建
```

必须全绿方可发起 PR。

## 提交与推送

- **及时提交、及时推送**：新增或修改的文件在自检通过后应立即提交并推送远程分支，
  避免本地长期堆积未推送的改动。一轮工作结束时，本地与远程必须处于一致状态。
- 推送后须复核：以 `git ls-remote origin` 或 GitHub API 返回的分支 SHA 与本地比对，
  不可仅凭推送命令的返回码判定成功。
- 若环境的凭据助手不可用（提示 `terminal prompts disabled`），显式指定
  Git Credential Manager：

  ```bash
  git -c credential.helper= -c credential.helper=manager push -u origin <分支名>
  ```

- 本环境下 remote-tracking 引用（`refs/remotes/origin/*`）可能失效，
  同步分支时直接按完整 SHA 操作：`git update-ref refs/heads/<分支> <sha>`。

## Pull Request 流程

1. 从 `develop` 切出功能分支
2. 开发并按规范提交
3. 自检全绿后推送：`git push -u origin <分支名>`
4. 发起 PR，目标分支为 **`develop`**（不是 `main`）
5. PR 标题须符合 Conventional Commits（CI 自动校验）
6. 按 PR 模板填写变更说明与自检清单
7. 至少一位 CODEOWNER 评审通过后方可合并
8. 合并方式：**Squash and merge**，保持提交历史线性清晰

## 测试要求

- `src/core/` 下的模块必须有单元测试覆盖
- 算法类模块优先采用**往返一致性**（正算→反算）作为正确性验证
- 规范类实现（如军标编码、坐标格式）优先与公开标准示例或第三方成熟实现交叉比对
