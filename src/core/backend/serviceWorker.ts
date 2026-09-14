/** 旧 PWA 曾缓存所有同源 GET；升级缓存策略后才允许建立后端写入会话。 */
async function networkOnly(worker: ServiceWorker | null): Promise<boolean> {
  if (!worker) return false;
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const finish = (value: boolean) => {
      clearTimeout(timer);
      channel.port1.close();
      resolve(value);
    };
    const timer = setTimeout(() => finish(false), 250);
    channel.port1.onmessage = (event) => finish(event.data?.apiNetworkOnly === true);
    try {
      worker.postMessage({ type: 'API_CACHE_POLICY' }, [channel.port2]);
    } catch {
      finish(false);
    }
  });
}

export async function ensureApiNetworkOnly(signal: AbortSignal) {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker?.controller) return;
  if (await networkOnly(navigator.serviceWorker.controller)) return;
  const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
    updateViaCache: 'none',
  });
  registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
  const deadline = Date.now() + 15000;
  while (!signal.aborted && Date.now() < deadline) {
    if (await networkOnly(navigator.serviceWorker.controller)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (signal.aborted) throw new DOMException('已取消', 'AbortError');
  throw new Error('正在更新离线缓存策略，请联网后重试保存。当前修改仍保留在浏览器。');
}
