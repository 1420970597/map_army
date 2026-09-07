/**
 * PWA 图标生成器。
 *
 * 直接以像素缓冲绘制并编码为 PNG，不依赖任何图形库：
 * 图标内容（深蓝底 + 军网 + 友军矩形框架）与站点主视觉一致，
 * 且每次构建都可复现，避免把二进制图片纳入版本库带来的维护成本。
 *
 * 绘制采用 4 倍超采样后盒式降采样，保证边缘平滑无需实现复杂的抗锯齿算法。
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 站点根目录（本文件位于 site/ 下） */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** 图标输出目录，直接落在 public/ 下由 Vite 原样拷贝 */
const OUT_DIR = join(ROOT, 'public', 'icons');

/** 品牌主色，与 global.css 中的 --brand 保持一致 */
const BRAND = [7, 99, 145];

/** 超采样倍数：先按 size × SS 绘制，再降采样 */
const SS = 4;

// ────────────────────────────────────────────────────────────
// 极简 PNG 编码器
// ────────────────────────────────────────────────────────────

/** CRC32 查表，PNG 规范要求每个数据块都带 CRC 校验 */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

/** 计算一段字节的 CRC32 */
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** 组装一个 PNG 数据块：长度 + 类型 + 数据 + CRC */
function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

/**
 * 将 RGBA 像素缓冲编码为 PNG 字节流。
 *
 * 颜色类型固定为 6（真彩色 + alpha），位深 8，无隔行扫描；
 * 每条扫描线前置过滤器字节 0（None），配合 deflate 已能获得足够压缩率。
 */
function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy
      ? rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4)
      : Buffer.from(rgba.buffer, y * width * 4, width * 4).copy(raw, rowStart + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 位深
  ihdr[9] = 6; // 颜色类型：RGBA
  ihdr[10] = 0; // 压缩方法：deflate
  ihdr[11] = 0; // 过滤器方法：自适应
  ihdr[12] = 0; // 隔行扫描：无

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ────────────────────────────────────────────────────────────
// 光栅绘制原语
// ────────────────────────────────────────────────────────────

/** 创建一块透明的超采样画布 */
function createCanvas(size) {
  const w = size * SS;
  return { w, h: w, data: new Uint8ClampedArray(w * w * 4) };
}

/** 以 source-over 方式把带 alpha 的颜色混合到画布上 */
function blend(canvas, x, y, color, alpha) {
  if (x < 0 || y < 0 || x >= canvas.w || y >= canvas.h || alpha <= 0) return;
  const i = (y * canvas.w + x) * 4;
  const a = Math.min(1, alpha);
  const d = canvas.data;
  d[i] = d[i] * (1 - a) + color[0] * a;
  d[i + 1] = d[i + 1] * (1 - a) + color[1] * a;
  d[i + 2] = d[i + 2] * (1 - a) + color[2] * a;
  d[i + 3] = d[i + 3] * (1 - a) + 255 * a;
}

/** 填充矩形 */
function fillRect(canvas, x, y, w, h, color, alpha = 1) {
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  const x1 = Math.round(x + w);
  const y1 = Math.round(y + h);
  for (let py = Math.max(0, y0); py < Math.min(canvas.h, y1); py += 1) {
    for (let px = Math.max(0, x0); px < Math.min(canvas.w, x1); px += 1) {
      blend(canvas, px, py, color, alpha);
    }
  }
}

/**
 * 绘制线段（圆头）。
 *
 * 遍历包围盒并计算点到线段的距离，距离小于半线宽即着色；
 * 复杂度 O(包围盒面积)，对图标这种小尺寸完全够用。
 */
function strokeLine(canvas, x0, y0, x1, y1, width, color, alpha = 1) {
  const half = width / 2;
  const minX = Math.floor(Math.min(x0, x1) - half - 1);
  const maxX = Math.ceil(Math.max(x0, x1) + half + 1);
  const minY = Math.floor(Math.min(y0, y1) - half - 1);
  const maxY = Math.ceil(Math.max(y0, y1) + half + 1);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lenSq = dx * dx + dy * dy;

  for (let py = minY; py <= maxY; py += 1) {
    for (let px = minX; px <= maxX; px += 1) {
      // 把点投影到线段上，取最近距离
      let t = lenSq === 0 ? 0 : ((px - x0) * dx + (py - y0) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const cx = x0 + t * dx;
      const cy = y0 + t * dy;
      const dist = Math.hypot(px - cx, py - cy);
      // 边缘 1 像素做线性过渡，配合超采样实现抗锯齿
      const coverage = Math.max(0, Math.min(1, half + 0.5 - dist));
      if (coverage > 0) blend(canvas, px, py, color, alpha * coverage);
    }
  }
}

/** 描边矩形（由四条线段围成） */
function strokeRect(canvas, x, y, w, h, width, color, alpha = 1) {
  strokeLine(canvas, x, y, x + w, y, width, color, alpha);
  strokeLine(canvas, x + w, y, x + w, y + h, width, color, alpha);
  strokeLine(canvas, x + w, y + h, x, y + h, width, color, alpha);
  strokeLine(canvas, x, y + h, x, y, width, color, alpha);
}

/** 盒式降采样：把 SS × SS 的像素块平均为一个像素 */
function downsample(canvas, size) {
  const out = Buffer.alloc(size * size * 4);
  const inv = 1 / (SS * SS);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const i = ((y * SS + sy) * canvas.w + (x * SS + sx)) * 4;
          r += canvas.data[i];
          g += canvas.data[i + 1];
          b += canvas.data[i + 2];
          a += canvas.data[i + 3];
        }
      }
      const o = (y * size + x) * 4;
      out[o] = Math.round(r * inv);
      out[o + 1] = Math.round(g * inv);
      out[o + 2] = Math.round(b * inv);
      out[o + 3] = Math.round(a * inv);
    }
  }
  return out;
}

// ────────────────────────────────────────────────────────────
// 图标内容
// ────────────────────────────────────────────────────────────

/**
 * 绘制图标主体。
 *
 * @param {number} size   输出边长（像素）
 * @param {number} scale  内容相对画布的缩放；maskable 图标需留出安全区故取更小值
 * @returns {Buffer} RGBA 像素
 */
function drawIcon(size, scale) {
  const canvas = createCanvas(size);
  const s = size * SS;
  const white = [255, 255, 255];

  // 背景：品牌深蓝铺满，maskable 图标同样铺满以保证任意遮罩下无白边
  fillRect(canvas, 0, 0, s, s, BRAND, 1);

  // 军网：纵横各 5 条等距细线，模拟军用网格参考
  const gridWidth = Math.max(1 * SS, s * 0.006);
  for (let i = 1; i <= 5; i += 1) {
    const p = (s * i) / 6;
    fillRect(canvas, p - gridWidth / 2, 0, gridWidth, s, white, 0.16);
    fillRect(canvas, 0, p - gridWidth / 2, s, gridWidth, white, 0.16);
  }

  // 友军框架：2525 标准中友军为矩形，这里作为品牌识别元素置于中央
  const frameW = s * 0.46 * scale;
  const frameH = s * 0.34 * scale;
  const fx = (s - frameW) / 2;
  const fy = (s - frameH) / 2;
  const strokeW = s * 0.05 * scale;
  strokeRect(canvas, fx, fy, frameW, frameH, strokeW, white, 1);

  // 框架内部：交叉的步枪线条，即步兵符号的简化表达
  const pad = frameW * 0.22;
  const innerW = frameW * 0.03;
  strokeLine(canvas, fx + pad, fy + pad, fx + frameW - pad, fy + frameH - pad, innerW, white, 1);
  strokeLine(canvas, fx + frameW - pad, fy + pad, fx + pad, fy + frameH - pad, innerW, white, 1);

  return downsample(canvas, size);
}

/** 需要产出的图标清单：文件名 + 边长 + 内容缩放 */
const TARGETS = [
  { file: 'icon-192.png', size: 192, scale: 1 },
  { file: 'icon-512.png', size: 512, scale: 1 },
  { file: 'maskable-192.png', size: 192, scale: 0.62 },
  { file: 'maskable-512.png', size: 512, scale: 0.62 },
  { file: 'apple-touch-icon.png', size: 180, scale: 0.9 },
];

mkdirSync(OUT_DIR, { recursive: true });
for (const target of TARGETS) {
  const png = encodePng(target.size, target.size, drawIcon(target.size, target.scale));
  writeFileSync(join(OUT_DIR, target.file), png);
  console.log(`  ✓ icons/${target.file}（${target.size}×${target.size}，${png.length} 字节）`);
}
console.log(`图标生成完毕：${TARGETS.length} 个 → public/icons/`);
