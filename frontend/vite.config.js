import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    minify: false, // Keep code readable for college project
  },
  server: {
    watch: {
      usePolling: true,    // Required for Docker bind-mount file watching
      interval: 1000,      // Check every 1s (low CPU cost)
    },
    proxy: {
      '/api': {
        target: process.env.PROXY_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
    },
    host: true, // Needed for Docker to expose the server
  },
  preview: {
    proxy: {
      '/api': {
        target: process.env.PROXY_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
    },
    host: true,
  },
})
