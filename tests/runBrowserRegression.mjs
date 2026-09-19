import { spawn } from 'node:child_process';
import { preview } from 'vite';

const defaultTests = [
  'tests/webGraphRegression.mjs',
  'tests/performanceBrowserRegression.mjs',
  'tests/evaluationBrowserRegression.mjs',
];
const tests = process.argv.length > 2 ? process.argv.slice(2) : defaultTests;

const run = file => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [file], { stdio: 'inherit', env: process.env });
  child.once('error', reject);
  child.once('exit', code => code === 0
    ? resolve()
    : reject(new Error(`${file} exited with status ${code}`)));
});

const server = await preview({
  configFile: 'vite.config.ts',
  preview: { host: '127.0.0.1', port: 5181, strictPort: true },
});

try {
  for (const test of tests) await run(test);
} finally {
  await server.close();
}
