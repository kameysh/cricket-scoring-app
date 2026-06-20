import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Satori (and some of its deps) reference Node.js globals in code paths
    // that never actually run in the browser — polyfill them at build time.
    global: 'globalThis',
    'process.env': '{}',
    'process.version': '"v18.0.0"',
    'process.platform': '"browser"',
  },
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 3000,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.js'],
  },
})
