/** 后端格式工具与目录种子由同一份 TypeScript 数据源生成。 */
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
await mkdir('backend/tool', { recursive: true });
await build({ entryPoints: ['backend/compat/exchange.ts'], outfile: 'backend/tool/exchange.cjs', bundle: true, platform: 'node', target: 'node20', format: 'cjs' });
await writeFile('backend/tool/catalog.json', execFileSync(process.execPath, ['backend/tool/exchange.cjs', '--catalog']));
await build({ entryPoints: ['backend/compat/validate-glb.mjs'], outfile: 'backend/tool/validate-glb.cjs', bundle: true, platform: 'node', target: 'node20', format: 'cjs' });
console.log('后端文件工具和目录种子已生成。');
await build({ entryPoints: ['backend/compat/assemble-glb.mjs'], outfile: 'backend/tool/assemble-glb.cjs', bundle: true, platform: 'node', target: 'node20', format: 'cjs' });
