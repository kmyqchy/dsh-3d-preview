# dsh-3d-preview

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![topic: dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-blue)](https://github.com/topics/dsh-plugin)
[![for dsh-better-sidebar](https://img.shields.io/badge/for-dsh--better--sidebar-8a2be2)](https://github.com/omdsh-dev/DSH-better-sidebar)

**在 [dsh-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar) 的文件树里直接预览 STL / 3MF —— 支持切片盘位与逐对象灯丝配色。**

在侧边栏文件树里点开一个 `.stl` 或 `.3mf`，不离开对话就能旋转、缩放、切盘位，看到切片机给每个对象分配的颜色。

[English](README.md)

![3MF 预览](docs/screenshot-3mf.png)

> 上图是一个真实的 Bambu Studio 工程：4 盘位 / 30 个对象 / 37 个实例 / 288,702 个三角面。
> 粉色与橙色来自 `Metadata/project_settings.config` 里的 `filament_colour`。

---

## 功能

| | |
| --- | --- |
| **格式** | `.stl`、`.3mf` |
| **3MF 覆盖范围** | 核心规范、**Production Extension**（`3D/Objects/*.model` 外部部件）、`basematerials` / `colorgroup`、Bambu/Orca 的 `paint_color` 面片着色 |
| **切片机扩展信息** | 盘位识别 + 盘位切换；逐对象**灯丝配色**，来自 `Metadata/project_settings.config` 与 `Metadata/model_settings.config` |
| **操作** | 拖拽旋转 · 滚轮缩放 · 右键平移 · **适配视图** · **截图**（PNG）· **全屏** |
| **底栏** | 三角面 · 对象 · 实例 · 包围盒尺寸(mm) · 材质置信度 · 盘位 chips |
| **失败处理** | 带真实阶段计数的进度浮层；解析或 WebGL 失败时给出重试 + 下载入口 |

不做无中生有：文件本身不带材质信息时，模型以中性灰渲染，底栏显示「材质 未知」——与底层渲染器相同的诚实约定。

## 为什么这个插件要多写一层代码

渲染交给 [`@chestnutlabs/gcode-model-renderer`](https://www.npmjs.com/package/@chestnutlabs/gcode-model-renderer)
（MIT，基于 `three`，不依赖 DOM，可在 Worker 中运行）。它负责解析两种格式、推导盘位与实例化、上报进度；本插件在其上补三件事：

1. **切片机配色的 id 连接。** Bambu/Orca 工程把颜色声明在三个地方，而 extruder 表以 3MF 的**核心对象 id** 为键，网格却位于用**另一个 id**（`p:path` / `objectid`）寻址的外部部件里。渲染器拿外部部件 id 去查表，于是每个对象都查不到，四色工程渲染成一片灰（实测：37 个放置位 0 命中）。`src/client/bambu-colors.ts` 直接从 zip 里重做这个连接——不 fork、不打补丁依赖——同一个文件随即 30/30 对象上色成功。
2. **界面外壳。** 进度、重试、盘位 chips、统计、截图、全屏。
3. **取数管道。** 字节走 better-sidebar 自己的 `/sidebar/file` 媒体路由，所以本插件**不新增任何 host 路由**。

## 安装

需要 Node 20+，且 profile 里已装 `dsh-better-sidebar`。

```bash
# 直接用最新 Release 的预构建 tarball —— 秒装，无需构建
dsh plugin --profile web add https://github.com/kmyqchy/dsh-3d-preview/releases/latest/download/dsh-3d-preview.tgz

# 或直接从仓库装 —— lib/ 已提交，同样不需要构建
dsh plugin --profile web add github:kmyqchy/dsh-3d-preview
```

然后**重启 `dsh web`**：profile 的 bundle 只在启动时合成，新装的插件要下次启动才会被服务。重启后 `lib/client.js` 出现在 `/plugins/dsh-3d-preview/client.js`。

<details>
<summary>从本地工作副本安装（开发用）</summary>

```bash
git clone https://github.com/kmyqchy/dsh-3d-preview.git && cd dsh-3d-preview
npm install --ignore-scripts     # 见下方说明
npm run build
dsh plugin --profile web add link:$PWD
```

`--ignore-scripts` 用来跳过传递依赖的原生构建（`dsh-better-sidebar` 会拉 `node-pty`，这里只用它的类型声明）。如果你不跑 `npm run typecheck`，可以把 `dsh-better-sidebar` 从 `devDependencies` 里整个删掉。
</details>

> 尚未发布到 npm，见[发布](#发布)。

## 实测

| 文件 | 结果 |
| --- | --- |
| Bambu Studio 工程 `*.3mf`，4.42 MB | 30 对象 / 37 实例 / 288,702 三角面 / 4 盘位（5+5+8+19）/ 粉橙配色正确落位 / 材质 已知 |
| PrusaSlicer 导出 `*.stl`，864 KB | 1 对象 / 17,686 三角面 / 13.7 × 12.4 × 63.0 mm |

另外核对过：`tsc --noEmit` 干净；descriptor 在真实的 `window.__ModuleLoader__` 契约下注册正确（id / exts / fetchStrategy / title / icon）；与内置 viewer 无扩展名冲突（内置为 `image` / `pdf` / `markdown` / `html` / `code`，以及优先级 −50、低于本插件 0 的 `binary-download`）。

## 在自己插件里注册同类 viewer

一切都是注册表，所以也可以在你自己的插件里注册一个 viewer：

```ts
import type { Context } from '@deepseek-ai/dsh-client-runtime/client'

export const inject = ['betterSidebar']

export function apply(ctx: Context) {
  ctx.effect(() => ctx.betterSidebar.registerFileViewer({
    id: 'my:model3d',
    exts: ['stl', '3mf'],
    fetchStrategy: 'mediaUrl',
    component: Model3DView,
  }))
}
```

## 边界与未做

- **20 MB 上限。** `/sidebar/file` 媒体路由受 `dsh-better-sidebar.mediaLimit` 限制（默认 20 MB），且整文件返回、不支持 `Accept-Ranges`。超限的文件会得到明确错误态 + **下载**入口，而不是一块坏掉的画布。本插件实测过的最大文件是 4.42 MB 的切片工程。
- **不支持 glTF / STEP / OBJ / PLY。** 引擎只带 STL 与 3MF loader；其 loader 注册表是开放的（`loaders: [...]`），要加是独立改动。
- **无线框 / 剖面 / 测量。** 渲染器只暴露适配取景、盘位范围与截图。
- **只有旋转 / 缩放 / 平移** —— 视角预设 API 目前只实现了等轴测，所以没有前后左右顶底的按钮。
- **不监听文件变化。** 字节走 HTTP 获取，拿不到 `mtime`；重新导出后请重新打开标签页。
- **不显示 Bambu 盘位缩略图**（`Metadata/plate_N.png`）——本插件渲染几何，不渲染切片机的预览图。
- **界面语言**跟随 `navigator.language`：`zh*` 出中文，其余出英文；没有应用内切换开关。

## 开发

```bash
npm run build      # esbuild：lib/index.js（host）+ lib/client.js（浏览器包）
npm run watch      # 改动后自动重建
npm run typecheck  # tsc --noEmit
npm test           # node --test：配色 id 连接的回归测试
```

`npm test` 不需要浏览器：它在内存里合成一个最小 Production-Extension 工程，断言颜色落到了正确的对象上。测试直接通过 Node 的类型剥离运行 TypeScript 源码，因此需要 Node 22.6+；发布出去的产物是普通 ES2020 ESM，Node 20+ 即可运行。

### 产物形态

`lib/client.js` 是一个注册到 `window.__ModuleLoader__` 的懒加载 CJS 闭包：

```js
window.__ModuleLoader__.load({ id: 'dsh-3d-preview', factory: (require) => { /* … */ return module.exports } })
```

`react` 与 `react/jsx-runtime` 走 shell 冻结的模块表，**其余全部内联**，包括 `three`。代码分割是关的——factory 的 `require` 只能命中模块表条目，相对 chunk URL 永远拉不到。约 560 KB 原始体积（gzip 约 150 KB），且只在打开模型文件时懒加载。

由于产物自包含，本包**没有任何运行时依赖**——`three`、模型渲染器与 `fflate` 都只是构建期依赖，这也是安装它不带来额外依赖成本的原因。

### 发布

推送 `v*` tag 时，release 工作流会构建、测试、打包，并把 `dsh-3d-preview.tgz` 挂到 GitHub Release 上：

```bash
npm version patch --no-git-tag-version   # 更新 package.json 与 CHANGELOG.md
git commit -am "release: v0.1.1"
git tag v0.1.1 && git push --follow-tags
```

资产名刻意**不带版本号**，上面那条 `releases/latest/download/dsh-3d-preview.tgz` 链接才能跨版本一直有效。手工上传 release 资产时请沿用这个名字。

暂未接入 npm 发布；将来若接入，tarball 这条路依然有效。

## 兼容性

基于并验证于 `dsh-better-sidebar` 0.19.x、`@chestnutlabs/gcode-model-renderer` 0.20.x、`three` 0.178（钉住——引擎的 peer 范围是 `0.x` caret）。

## 许可

MIT。`three`（MIT）与 `@chestnutlabs/gcode-model-renderer`（MIT）被打进客户端产物，声明见各自仓库。
