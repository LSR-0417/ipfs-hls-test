import { afterEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runShellScript, writeExecutable } from './shell_test_utils.js';

const scriptPath = fileURLToPath(new URL('./package_youtube_assets.sh', import.meta.url));
const tempRoots = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function createToolchain({ withJq = true, jqOutput = '{"id":"abc123","title":"Packaged"}\n' } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'package-youtube-assets-'));
  const binDir = join(root, 'bin');
  tempRoots.push(root);

  await mkdir(binDir);

  if (withJq) {
    await writeExecutable(
      join(binDir, 'jq'),
      `#!/bin/bash
set -euo pipefail
if [ -n "\${JQ_TEST_OUTPUT:-}" ]; then
  printf '%s' "$JQ_TEST_OUTPUT"
else
  printf '%s\\n' '{"id":"abc123","title":"Packaged"}'
fi
`,
    );
  }

  return {
    root,
    env: {
      ...process.env,
      PATH: `${binDir}:/usr/bin:/bin:/usr/sbin:/sbin`,
      JQ_TEST_OUTPUT: jqOutput,
    },
  };
}

describe('package_youtube_assets.sh', () => {
  it('fails fast when jq is unavailable', async () => {
    const root = await mkdtemp(join(tmpdir(), 'package-youtube-assets-no-jq-'));
    tempRoots.push(root);

    const result = await runShellScript(scriptPath, {
      cwd: root,
      env: { PATH: root },
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stdout).toContain('系統找不到 jq');
  });

  it('fails when no info.json file exists in the current directory', async () => {
    const toolchain = await createToolchain();

    const result = await runShellScript(scriptPath, {
      cwd: toolchain.root,
      env: toolchain.env,
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stdout).toContain('找不到任何 .info.json');
  });

  it('packages subtitles, cover art, and avatar into a sidecar folder while preserving originals', async () => {
    const toolchain = await createToolchain();
    const baseName = 'Video Title [abc123]';
    const targetDir = join(toolchain.root, baseName);

    await writeFile(join(toolchain.root, `${baseName}.info.json`), '{"id":"abc123"}\n');
    await writeFile(join(toolchain.root, `${baseName}.en.vtt`), 'WEBVTT EN\n');
    await writeFile(join(toolchain.root, `${baseName}.zh-TW.vtt`), 'WEBVTT ZH\n');
    await writeFile(join(toolchain.root, `${baseName}.webp`), 'cover');
    await writeFile(join(toolchain.root, 'channel_avatar.jpg'), 'avatar');

    const result = await runShellScript(scriptPath, {
      cwd: toolchain.root,
      env: toolchain.env,
    });

    expect(result.exitCode).toBe(0);
    await expect(readFile(join(targetDir, 'info.json'), 'utf8')).resolves.toBe('{"id":"abc123","title":"Packaged"}\n');
    await expect(readFile(join(targetDir, 'en.vtt'), 'utf8')).resolves.toBe('WEBVTT EN\n');
    await expect(readFile(join(targetDir, 'zh-TW.vtt'), 'utf8')).resolves.toBe('WEBVTT ZH\n');
    await expect(readFile(join(targetDir, 'cover.webp'), 'utf8')).resolves.toBe('cover');
    await expect(readFile(join(targetDir, 'avatar.jpg'), 'utf8')).resolves.toBe('avatar');
    await expect(readFile(join(toolchain.root, `${baseName}.webp`), 'utf8')).resolves.toBe('cover');
    await expect(readFile(join(toolchain.root, 'channel_avatar.jpg'), 'utf8')).resolves.toBe('avatar');
  });

  it('does not reuse the cover image as avatar when no separate avatar file exists', async () => {
    const toolchain = await createToolchain();
    const baseName = 'Video Title [abc123]';
    const targetDir = join(toolchain.root, baseName);

    await writeFile(join(toolchain.root, `${baseName}.info.json`), '{"id":"abc123"}\n');
    await writeFile(join(toolchain.root, `${baseName}.en.vtt`), 'WEBVTT EN\n');
    await writeFile(join(toolchain.root, `${baseName}.webp`), 'cover');

    const result = await runShellScript(scriptPath, {
      cwd: toolchain.root,
      env: toolchain.env,
    });

    expect(result.exitCode).toBe(0);
    await expect(readFile(join(targetDir, 'cover.webp'), 'utf8')).resolves.toBe('cover');
    await expect(stat(join(targetDir, 'avatar.webp'))).rejects.toThrow();
    expect(result.stdout).toContain('沒有找到可用的頭像檔');
  });
});
