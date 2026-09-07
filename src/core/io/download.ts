/**
 * 文件下载与读取。
 *
 * 把内存中的数据转换为浏览器下载，以及反向地把用户选择的文件读入内存。
 * 全部操作在客户端完成，不涉及任何服务端交互。
 */

/** 下载选项 */
export interface DownloadOptions {
  /** 文件名（含扩展名） */
  filename: string;
  /** MIME 类型 */
  mimeType: string;
}

/** 触发一次文本文件的下载 */
export function downloadText(text: string, options: DownloadOptions): void {
  downloadBlob(new Blob([text], { type: options.mimeType }), options.filename);
}

/** 触发一次二进制文件的下载 */
export function downloadBytes(data: Uint8Array, options: DownloadOptions): void {
  // 通过 slice 拷贝到独立的 ArrayBuffer，避免把整个缓冲区视图传出
  const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  downloadBlob(new Blob([buffer], { type: options.mimeType }), options.filename);
}

/** 触发 Blob 下载并在完成后释放对象 URL */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // 立即回收会打断部分浏览器的下载流程，延后一帧释放
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * 弹出文件选择框并读取为文本。
 *
 * @param accept 可接受的文件扩展名，如 '.milxly,.geojson'
 * @returns 文件内容与文件名，用户取消时返回 null
 */
export function pickTextFile(accept: string): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, text: String(reader.result) });
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    });

    // 部分浏览器在 DOM 未挂载时不会触发 change，故先插入再点击
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  });
}

/**
 * 弹出文件选择框并读取为二进制。
 *
 * @param accept 可接受的文件扩展名
 * @returns 文件内容与文件名，用户取消时返回 null
 */
export function pickBinaryFile(accept: string): Promise<{ name: string; data: Uint8Array } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }

      const reader = new FileReader();
      reader.onload = () =>
        resolve({ name: file.name, data: new Uint8Array(reader.result as ArrayBuffer) });
      reader.onerror = () => resolve(null);
      reader.readAsArrayBuffer(file);
    });

    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  });
}

/**
 * 由文档名生成安全的文件名。
 *
 * 去除文件系统不允许的字符，并保证扩展名正确。
 */
export function toSafeFilename(name: string, extension: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '_').trim();
  const base = cleaned.length > 0 ? cleaned : '未命名标图';
  return base.endsWith(extension) ? base : `${base}${extension}`;
}
