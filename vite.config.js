import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    // Der Proxy leitet Anfragen vom Browser an den echten Server um
    // vite.config.js
    proxy: {
      '/api': {
        target: 'https://localhost/db/svwsdb', 
        changeOrigin: true,
        secure: false, 
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})