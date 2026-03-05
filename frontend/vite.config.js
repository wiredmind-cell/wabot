import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy API requests to the backend during development
    // so you don't need CORS or absolute URLs in fetch calls
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/invoices': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  }
})
