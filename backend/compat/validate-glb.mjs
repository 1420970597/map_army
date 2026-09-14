/** 在有内存和时间上限的独立进程中执行 glTF 官方结构校验。 */
import { readFileSync } from 'node:fs';
import validator from 'gltf-validator';
async function main() {
try {
  const report = await validator.validateBytes(new Uint8Array(readFileSync(0)), {
    maxIssues: 30,
    externalResourceFunction: () => Promise.reject(new Error('模型必须自包含')),
  });
  const errors = report.issues.messages.filter(issue => issue.severity === 0);
  process.stdout.write(JSON.stringify({ errors }));
  process.exitCode = report.issues.numErrors ? 1 : 0;
} catch {
  process.stdout.write(JSON.stringify({ errors: [{ message: 'GLB 结构无法读取' }] }));
  process.exitCode = 1;
}

}
void main();
