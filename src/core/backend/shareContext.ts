/** 文件、模型目录与项目复制均使用页面当前已打开的分享版本。 */
import { useAccessStore } from '@/stores/useAccessStore';

export function shareQuery() {
  const opened = useAccessStore.getState().shared;
  const params = new URLSearchParams(window.location.search);
  const query = new URLSearchParams();
  if (opened) {
    query.set('share', opened.id);
    query.set('version', String(opened.version));
  } else {
    for (const key of ['share', 'version']) if (params.has(key)) query.set(key, params.get(key)!);
  }
  return query.toString();
}
