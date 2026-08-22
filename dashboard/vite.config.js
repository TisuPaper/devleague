import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Proxy API calls to the local services so the browser sees same-origin
// requests (no CORS preflight, no hardcoded ports in the frontend bundle).
// Override the backend with VITE_API_BASE_URL if it runs elsewhere.
const proxy = {
  '/api': {
    target: 'http://127.0.0.1:8000',
    changeOrigin: true,
  },
  // Agent A, the x402 paying agent. A separate process from the FastAPI
  // backend on purpose — it is the only one holding a wallet signing key.
  '/x402': {
    target: 'http://127.0.0.1:8401',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/x402/, ''),
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { proxy },
  // `vite preview` needs its own copy — it does not inherit server.proxy, and
  // without it the Pay button 404s when testing a production build.
  preview: { proxy },
})
