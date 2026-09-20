import { fileURLToPath, URL } from 'node:url'
import { realpathSync } from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Use the same physical Windows path for the root and resolved HTML entry.
const projectRoot = realpathSync.native(fileURLToPath(new URL('.', import.meta.url)))

export default defineConfig({
  root: projectRoot,
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.join(projectRoot, 'src'),
    },
  },
  server: {
    fs: {
      allow: [projectRoot],
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3100',
        changeOrigin: true,
      },
    },
  },
})
