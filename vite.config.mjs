import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vue from '@vitejs/plugin-vue';
import { configDefaults, defineConfig } from 'vitest/config';

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
);

function readGitMeta(command, fallback = '') {
  try {
    return execSync(command, {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch (_) {
    return fallback;
  }
}

const worktreeRoot =
  readGitMeta('git rev-parse --show-toplevel', process.cwd()) || process.cwd();
const branchName = readGitMeta('git rev-parse --abbrev-ref HEAD');
const worktreeName = path.basename(worktreeRoot);

export default defineConfig({
  server: {
    host: true, // Listen on all local IPs
  },
  plugins: [vue()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __APP_BRANCH__: JSON.stringify(branchName),
    __APP_WORKTREE__: JSON.stringify(worktreeName),
  },
  base: '/ipfs-hls-test/',
  resolve: {
    alias: {
      'videojs-hls-quality-selector':
        'videojs-hls-quality-selector/src/plugin.js',
    },
  },
  optimizeDeps: {
    include: ['video.js'],
    esbuildOptions: {
      sourcemap: false,
    },
  },
  test: {
    exclude: [...configDefaults.exclude, '.worktrees/**'],
  },
});
