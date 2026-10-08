/**
 * Minimal self-contained locale table (zh-CN default, en fallback).
 *
 * better-sidebar exposes a locale service, but a file viewer should not depend
 * on another plugin's client internals: this table keeps the bundle
 * self-contained, exactly like the ecosystem's other viewer plugins.
 *
 * @module dsh-3d-preview/client/locales
 */

/** Every user-visible string in this plugin. */
export interface Dict {
  viewerTitle: string
  loadingFile: string
  parsing3mf: string
  buildingGeometry: string
  preparing: string
  ready: string
  errorTitle: string
  webglUnavailable: string
  retry: string
  download: string
  fit: string
  snapshot: string
  snapshotFailed: string
  fullscreen: string
  exitFullscreen: string
  objects: string
  instances: string
  triangles: string
  size: string
  materials: string
  materialsKnown: string
  materialsApproximated: string
  materialsUnavailable: string
  coloredByFilament: string
  plates: string
  allPlates: string
  plate: string
  rotateHint: string
  tooLarge: string
}

const zh: Dict = {
  viewerTitle: '3D 模型',
  loadingFile: '读取文件…',
  parsing3mf: '解析 3MF…',
  buildingGeometry: '构建几何',
  preparing: '准备中…',
  ready: '就绪',
  errorTitle: '无法预览',
  webglUnavailable: '当前浏览器/环境不支持 WebGL，无法渲染 3D 模型。',
  retry: '重试',
  download: '下载原件',
  fit: '适配视图',
  snapshot: '截图',
  snapshotFailed: '截图失败',
  fullscreen: '全屏',
  exitFullscreen: '退出全屏',
  objects: '对象',
  instances: '实例',
  triangles: '三角面',
  size: '尺寸',
  materials: '材质',
  materialsKnown: '已知',
  materialsApproximated: '近似',
  materialsUnavailable: '未知',
  coloredByFilament: '已按切片机灯丝颜色着色',
  plates: '盘位',
  allPlates: '全部',
  plate: '盘',
  rotateHint: '左键拖拽旋转 · 滚轮缩放 · 右键平移',
  tooLarge: '文件超过 20 MB 上限，已跳过预览',
}

const en: Dict = {
  viewerTitle: '3D model',
  loadingFile: 'Reading file…',
  parsing3mf: 'Parsing 3MF…',
  buildingGeometry: 'Building geometry',
  preparing: 'Preparing…',
  ready: 'Ready',
  errorTitle: 'Cannot preview',
  webglUnavailable: 'WebGL is unavailable here, so the 3D model cannot be rendered.',
  retry: 'Retry',
  download: 'Download',
  fit: 'Fit view',
  snapshot: 'Snapshot',
  snapshotFailed: 'Snapshot failed',
  fullscreen: 'Fullscreen',
  exitFullscreen: 'Exit fullscreen',
  objects: 'Objects',
  instances: 'Instances',
  triangles: 'Triangles',
  size: 'Size',
  materials: 'Materials',
  materialsKnown: 'known',
  materialsApproximated: 'approximated',
  materialsUnavailable: 'unavailable',
  coloredByFilament: 'coloured from the slicer filament palette',
  plates: 'Plates',
  allPlates: 'All',
  plate: 'Plate',
  rotateHint: 'Drag to orbit · wheel to zoom · right-drag to pan',
  tooLarge: 'File exceeds the 20 MB preview limit',
}

const TABLES: Record<string, Dict> = { zh, en }

/** Resolve the table once, from the host document's language. */
const table: Dict = (() => {
  if (typeof navigator === 'undefined') return zh
  const lang = (navigator.language || '').toLowerCase()
  return lang.startsWith('zh') ? zh : en
})()

/** Translate one key. */
export function t<K extends keyof Dict>(key: K): string {
  return table[key]
}
