import { afterEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runShellScript, writeExecutable } from './shell_test_utils.js';

const scriptPath = fileURLToPath(new URL('./download_youtube_assets.sh', import.meta.url));
const tempRoots = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function createToolchain({
  withYtDlp = true,
  withFfmpeg = true,
  videoId = 'abc123',
  rawDirName = '20240101_My Channel_Bad:Title?_abc123',
  channelUrl = 'https://www.youtube.com/@demo',
} = {}) {
  const root = await mkdtemp(join(tmpdir(), 'download-youtube-assets-'));
  const binDir = join(root, 'bin');
  const logPath = join(root, 'yt-dlp.log');
  tempRoots.push(root);

  await mkdir(binDir);

  if (withYtDlp) {
    await writeExecutable(
      join(binDir, 'yt-dlp'),
      `#!/bin/bash
set -euo pipefail

if [ -n "\${YTDLP_TEST_LOG:-}" ]; then
  {
    for arg in "$@"; do
      printf '%q ' "$arg"
    done
    printf '\\n'
  } >> "$YTDLP_TEST_LOG"
fi

if [ "\${1:-}" = "-O" ]; then
  case "\${2:-}" in
    "%(id)s")
      printf '%s\\n' "\${YTDLP_TEST_ID:-abc123}"
      ;;
    "%(upload_date)s_%(uploader)s_%(title)s_%(id)s")
      printf '%s\\n' "\${YTDLP_TEST_DIRNAME:-20240101_My Channel_Bad:Title?_abc123}"
      ;;
    "%(channel_url)s")
      printf '%s\\n' "\${YTDLP_TEST_CHANNEL_URL:-https://www.youtube.com/@demo}"
      ;;
    *)
      echo "unexpected print template: \${2:-}" >&2
      exit 1
      ;;
  esac
  exit 0
fi

args=("$@")
output_dir=""
output_template=""

for ((i=0; i<\${#args[@]}; i++)); do
  case "\${args[i]}" in
    -P)
      output_dir="\${args[i+1]}"
      ;;
    -o)
      output_template="\${args[i+1]}"
      ;;
  esac
done

if [ -n "$output_template" ]; then
  if [ "\${YTDLP_TEST_AVATAR_FAIL:-0}" = "1" ]; then
    exit 1
  fi

  output_file="\${output_template//%(ext)s/\${YTDLP_TEST_AVATAR_EXT:-jpg}}"
  mkdir -p "$(dirname "$output_file")"
  printf 'avatar' > "$output_file"
  exit 0
fi

if [ -n "$output_dir" ]; then
  mkdir -p "$output_dir"
  printf 'video' > "$output_dir/downloaded.mp4"
  printf '{}' > "$output_dir/downloaded.info.json"
  printf 'WEBVTT\\n' > "$output_dir/downloaded.en.vtt"
  printf 'cover' > "$output_dir/downloaded.webp"
  exit 0
fi

echo "unexpected invocation" >&2
exit 1
`,
    );
  }

  if (withFfmpeg) {
    await writeExecutable(
      join(binDir, 'ffmpeg'),
      `#!/bin/bash
exit 0
`,
    );
  }

  return {
    root,
    env: {
      ...process.env,
      PATH: `${binDir}:/usr/bin:/bin:/usr/sbin:/sbin`,
      YTDLP_TEST_LOG: logPath,
      YTDLP_TEST_ID: videoId,
      YTDLP_TEST_DIRNAME: rawDirName,
      YTDLP_TEST_CHANNEL_URL: channelUrl,
    },
    logPath,
  };
}

describe('download_youtube_assets.sh', () => {
  it('fails fast when yt-dlp is unavailable', async () => {
    const root = await mkdtemp(join(tmpdir(), 'download-youtube-assets-no-ytdlp-'));
    tempRoots.push(root);

    const result = await runShellScript(scriptPath, {
      cwd: root,
      env: { PATH: root },
      input: 'https://www.youtube.com/watch?v=abc123\n',
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stdout).toContain('系統找不到 yt-dlp');
  });

  it('fails fast when ffmpeg is unavailable', async () => {
    const toolchain = await createToolchain({ withFfmpeg: false });

    const result = await runShellScript(scriptPath, {
      cwd: toolchain.root,
      env: toolchain.env,
      input: 'https://www.youtube.com/watch?v=abc123\n',
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stdout).toContain('系統找不到 ffmpeg');
  });

  it('sanitizes the download directory name and uses the cleaned watch URL for yt-dlp calls', async () => {
    const toolchain = await createToolchain();
    const rawUrl = 'https://www.youtube.com/watch?v=abc123&t=99s&list=PL123';
    const expectedDir = join(toolchain.root, '20240101_My_Channel_BadTitle_abc123');

    const result = await runShellScript(scriptPath, {
      cwd: toolchain.root,
      env: toolchain.env,
      input: `${rawUrl}\n`,
    });

    const log = await readFile(toolchain.logPath, 'utf8');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('已淨化網址: https://www.youtube.com/watch?v=abc123');
    await expect(stat(expectedDir)).resolves.toBeDefined();
    await expect(readFile(join(expectedDir, 'downloaded.mp4'), 'utf8')).resolves.toBe('video');
    await expect(readFile(join(expectedDir, 'downloaded.info.json'), 'utf8')).resolves.toBe('{}');
    await expect(readFile(join(expectedDir, 'channel_avatar.jpg'), 'utf8')).resolves.toBe('avatar');
    expect(log).toContain('https://www.youtube.com/watch\\?v=abc123\\&t=99s\\&list=PL123');
    expect(log).toContain('https://www.youtube.com/watch\\?v=abc123');
    expect(log).toContain('--skip-download');
    expect(log).toContain('https://www.youtube.com/@demo');
  });

  it('skips the avatar download when the channel URL is unavailable', async () => {
    const toolchain = await createToolchain({ channelUrl: 'NA' });
    const result = await runShellScript(scriptPath, {
      cwd: toolchain.root,
      env: toolchain.env,
      input: 'https://www.youtube.com/watch?v=abc123\n',
    });

    const targetDir = join(toolchain.root, '20240101_My_Channel_BadTitle_abc123');
    const log = await readFile(toolchain.logPath, 'utf8');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('取不到頻道網址，已略過頭像下載');
    await expect(readFile(join(targetDir, 'downloaded.mp4'), 'utf8')).resolves.toBe('video');
    await expect(stat(join(targetDir, 'channel_avatar.jpg'))).rejects.toThrow();
    expect(log).not.toContain('--skip-download');
  });
});
