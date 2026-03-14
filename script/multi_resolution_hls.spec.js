import { afterEach, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(new URL('./multi_resolution_hls.sh', import.meta.url));
const tempRoots = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function writeExecutable(path, content) {
  await writeFile(path, content);
  await chmod(path, 0o755);
}

async function createToolchain({ height = 1080, withFfmpeg = true } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'multi-resolution-hls-'));
  const binDir = join(root, 'bin');
  tempRoots.push(root);

  await mkdir(binDir);

  if (withFfmpeg) {
    await writeExecutable(
      join(binDir, 'ffmpeg'),
      `#!/bin/bash
set -euo pipefail

args=("$@")
output_pattern="\${args[\${#args[@]}-1]}"
var_stream_map=""

for ((i=0; i<\${#args[@]}; i++)); do
  if [ "\${args[i]}" = "-var_stream_map" ]; then
    var_stream_map="\${args[i+1]}"
    break
  fi
done

if [ -z "$var_stream_map" ]; then
  echo "missing -var_stream_map" >&2
  exit 1
fi

root_dir="\${output_pattern%/*}"
root_dir="\${root_dir%/*}"
mkdir -p "$root_dir"

{
  printf '#EXTM3U\\n'
  printf '#EXT-X-VERSION:3\\n'
} > "$root_dir/index.m3u8"

for stream in $var_stream_map; do
  name="\${stream##*name:}"
  variant_dir="$root_dir/$name"

  mkdir -p "$variant_dir"
  {
    printf '#EXTM3U\\n'
    printf '#EXTINF:5.0,\\n'
    printf 'segment_000.ts\\n'
    printf '#EXTINF:5.0,\\n'
    printf 'segment_001.ts\\n'
  } > "$variant_dir/temp.m3u8"
  : > "$variant_dir/segment_000.ts"
  : > "$variant_dir/segment_001.ts"
  printf '#EXT-X-STREAM-INF:BANDWIDTH=1000000\\n%s/temp.m3u8\\n' "$name" >> "$root_dir/index.m3u8"
done
`,
    );
  }

  await writeExecutable(
    join(binDir, 'ffprobe'),
    `#!/bin/bash
printf '%s\\n' "\${HLS_TEST_HEIGHT:-${height}}"
`,
  );

  return {
    root,
    env: {
      ...process.env,
      HLS_TEST_HEIGHT: String(height),
      PATH: `${binDir}:/usr/bin:/bin:/usr/sbin:/sbin`,
    },
  };
}

async function runScript(args, env) {
  try {
    const result = await execFileAsync(scriptPath, args, { env });
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return {
      exitCode: error.code ?? 1,
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? '',
    };
  }
}

function getPlaylistLines(manifest) {
  return manifest
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.endsWith('.m3u8') && !line.startsWith('#'));
}

function getSegmentLines(manifest) {
  return manifest
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.endsWith('.ts') && !line.startsWith('#'));
}

describe('multi_resolution_hls.sh', () => {
  it('fails fast when ffmpeg is unavailable', async () => {
    const root = await mkdtemp(join(tmpdir(), 'multi-resolution-hls-no-ffmpeg-'));
    tempRoots.push(root);

    const result = await runScript(['video.mp4'], { PATH: root });

    expect(result.exitCode).not.toBe(0);
    expect(result.stdout).toContain('系統找不到 FFmpeg 核心套件');
  });

  it('fails when the input file path is missing', async () => {
    const toolchain = await createToolchain();

    const result = await runScript([], toolchain.env);

    expect(result.exitCode).not.toBe(0);
    expect(result.stdout).toContain('請提供影片檔案路徑');
  });

  it('keeps each master playlist entry aligned with its variant playlist name', async () => {
    const toolchain = await createToolchain({ height: 1080 });
    const inputFile = join(toolchain.root, 'demo.mp4');

    await writeFile(inputFile, '');

    const result = await runScript([inputFile], toolchain.env);
    const outputDir = join(toolchain.root, 'demo');
    const masterPlaylist = await readFile(join(outputDir, 'index.m3u8'), 'utf8');

    expect(result.exitCode).toBe(0);
    expect(getPlaylistLines(masterPlaylist)).toEqual([
      '1080p/streaminglist-1080p.m3u8',
      '720p/streaminglist-720p.m3u8',
      '480p/streaminglist-480p.m3u8',
    ]);

    await expect(readFile(join(outputDir, '1080p', 'streaminglist-1080p.m3u8'), 'utf8')).resolves.toContain(
      '#EXTM3U',
    );
    await expect(readFile(join(outputDir, '720p', 'streaminglist-720p.m3u8'), 'utf8')).resolves.toContain(
      '#EXTM3U',
    );
    await expect(readFile(join(outputDir, '480p', 'streaminglist-480p.m3u8'), 'utf8')).resolves.toContain(
      '#EXTM3U',
    );
  });

  it('renames segment files to include the resolution name and updates variant playlists', async () => {
    const toolchain = await createToolchain({ height: 1080 });
    const inputFile = join(toolchain.root, 'demo.mp4');

    await writeFile(inputFile, '');

    const result = await runScript([inputFile], toolchain.env);
    const outputDir = join(toolchain.root, 'demo');
    const variantPlaylist = await readFile(join(outputDir, '1080p', 'streaminglist-1080p.m3u8'), 'utf8');

    expect(result.exitCode).toBe(0);
    expect(getSegmentLines(variantPlaylist)).toEqual([
      'segment_1080p_000.ts',
      'segment_1080p_001.ts',
    ]);

    await expect(readFile(join(outputDir, '1080p', 'segment_1080p_000.ts'), 'utf8')).resolves.toBe('');
    await expect(readFile(join(outputDir, '1080p', 'segment_1080p_001.ts'), 'utf8')).resolves.toBe('');
  });

  it('falls back to orig output when the source height is below 480p', async () => {
    const toolchain = await createToolchain({ height: 360 });
    const inputFile = join(toolchain.root, 'low-res.mp4');

    await writeFile(inputFile, '');

    const result = await runScript([inputFile], toolchain.env);
    const outputDir = join(toolchain.root, 'low-res');
    const masterPlaylist = await readFile(join(outputDir, 'index.m3u8'), 'utf8');

    expect(result.exitCode).toBe(0);
    expect(getPlaylistLines(masterPlaylist)).toEqual(['orig/streaminglist-orig.m3u8']);
    await expect(readFile(join(outputDir, 'orig', 'streaminglist-orig.m3u8'), 'utf8')).resolves.toContain(
      '#EXTM3U',
    );
  });
});
