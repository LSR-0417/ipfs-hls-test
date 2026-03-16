import { spawn } from 'node:child_process';
import { chmod, writeFile } from 'node:fs/promises';

export async function writeExecutable(path, content) {
  await writeFile(path, content);
  await chmod(path, 0o755);
}

export function runShellScript(scriptPath, { args = [], cwd, env, input = '' } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(scriptPath, args, {
      cwd,
      env,
      stdio: 'pipe',
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (exitCode) => {
      resolve({ exitCode, stdout, stderr });
    });

    child.stdin.end(input);
  });
}
