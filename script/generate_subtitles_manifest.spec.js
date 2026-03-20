import { afterEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runShellScript } from './shell_test_utils.js';

const scriptPath = fileURLToPath(new URL('./generate_subtitles_manifest.sh', import.meta.url));
const tempRoots = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('generate_subtitles_manifest.sh', () => {
  it('writes a manifest for all VTT files in the target directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'generate-subtitles-manifest-'));
    tempRoots.push(root);

    await writeFile(join(root, 'en.vtt'), 'WEBVTT EN\n');
    await writeFile(join(root, 'zh-TW.vtt'), 'WEBVTT ZH\n');

    const result = await runShellScript(scriptPath, {
      cwd: root,
      args: [root],
    });

    expect(result.exitCode).toBe(0);
    await expect(readFile(join(root, 'subtitles.json'), 'utf8')).resolves.toBe(
      '{\n  "version": 1,\n  "tracks": [\n    {"lang": "en", "path": "en.vtt"},\n    {"lang": "zh-TW", "path": "zh-TW.vtt"}\n  ]\n}\n'
    );
  });

  it('writes an empty manifest when no VTT files are present', async () => {
    const root = await mkdtemp(join(tmpdir(), 'generate-subtitles-manifest-empty-'));
    tempRoots.push(root);
    await mkdir(join(root, 'sidecar'));

    const result = await runShellScript(scriptPath, {
      cwd: root,
      args: [join(root, 'sidecar')],
    });

    expect(result.exitCode).toBe(0);
    await expect(readFile(join(root, 'sidecar', 'subtitles.json'), 'utf8')).resolves.toBe(
      '{\n  "version": 1,\n  "tracks": [  ]\n}\n'
    );
  });
});
