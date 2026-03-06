import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  server: {
    host: true, // Listen on all local IPs
  },
  plugins: [vue()],
  base: '/',
  resolve: {
    alias: {
      'videojs-hls-quality-selector':
        'videojs-hls-quality-selector/src/plugin.js',
    },
  },
  optimizeDeps: {
    include: ['video.js', 'videojs-contrib-quality-levels'],
    esbuildOptions: {
      sourcemap: false,
    },
  },
});
