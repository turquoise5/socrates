import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('development'),
    'process.env.IS_PREACT': JSON.stringify('false'),
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['@excalidraw/excalidraw'],
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
