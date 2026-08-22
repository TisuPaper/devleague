import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy API calls to the FastAPI backend so the browser sees same-origin
    // requests in dev (no CORS preflight, no hardcoded localhost:8000 in the
    // frontend bundle). Override the target with VITE_API_BASE_URL if the
    // backend runs elsewhere.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
