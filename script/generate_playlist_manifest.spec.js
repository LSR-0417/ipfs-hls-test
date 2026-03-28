import { afterEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runShellScript } from './shell_test_utils.js';

const scriptPath = fileURLToPath(new URL('./generate_playlist_manifest.sh', import.meta.url));
const tempRoots = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('generate_playlist_manifest.sh', () => {
  it('writes playlist.json from episode folders and prefers info.json titles', async () => {
    const root = await mkdtemp(join(tmpdir(), 'generate-playlist-manifest-'));
    tempRoots.push(root);

    await mkdir(join(root, 'ep10'));
    await mkdir(join(root, 'ep02'));
    await mkdir(join(root, 'assets'));
    await writeFile(join(root, 'ep10', 'index.m3u8'), '#EXTM3U\n');
    await writeFile(
      join(root, 'ep10', 'info.json'),
      JSON.stringify({ title: 'Final Episode', uploader: 'Uploader B', duration_string: '08:21' }, null, 2)
    );
    await writeFile(join(root, 'ep10', 'cid.txt'), 'bafy-ep10\n');
    await writeFile(
      join(root, 'ep02', 'info.json'),
      JSON.stringify({ title: 'Second Episode', uploader: 'Uploader A', duration_string: '12:34', cid: 'bafy-ep02' }, null, 2)
    );
    await writeFile(join(root, 'playlist.json'), JSON.stringify({ version: 1, title: 'Existing Series', episodes: [] }, null, 2));

    const result = await runShellScript(scriptPath, {
      cwd: root,
      args: [root],
    });

    expect(result.exitCode).toBe(0);
    await expect(readFile(join(root, 'playlist.json'), 'utf8')).resolves.toBe(
      '{\n' +
        '  "version": 1,\n' +
        '  "title": "Existing Series",\n' +
        '  "episodes": [\n' +
        '    {\n' +
        '      "id": "ep02",\n' +
        '      "number": 2,\n' +
        '      "title": "Second Episode",\n' +
        '      "path": "ep02",\n' +
        '      "playable": false,\n' +
        '      "cid": "bafy-ep02",\n' +
        '      "uploader": "Uploader A",\n' +
        '      "durationString": "12:34"\n' +
        '    },\n' +
        '    {\n' +
        '      "id": "ep10",\n' +
        '      "number": 10,\n' +
        '      "title": "Final Episode",\n' +
        '      "path": "ep10",\n' +
        '      "playable": true,\n' +
        '      "cid": "bafy-ep10",\n' +
        '      "uploader": "Uploader B",\n' +
        '      "durationString": "08:21"\n' +
        '    }\n' +
        '  ]\n' +
        '}\n'
    );
  });

  it('uses the explicit series title and writes an empty playlist when no episode folders are detected', async () => {
    const root = await mkdtemp(join(tmpdir(), 'generate-playlist-manifest-empty-'));
    tempRoots.push(root);
    await mkdir(join(root, 'misc'));
    await writeFile(join(root, 'misc', 'readme.txt'), 'noop\n');

    const result = await runShellScript(scriptPath, {
      cwd: root,
      args: [root, 'Manual Series Title'],
    });

    expect(result.exitCode).toBe(0);
    await expect(readFile(join(root, 'playlist.json'), 'utf8')).resolves.toBe(
      '{\n  "version": 1,\n  "title": "Manual Series Title",\n  "episodes": []\n}\n'
    );
  });
});
