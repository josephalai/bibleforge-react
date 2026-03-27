import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  // Load root-level .env so port config is shared with Docker Compose
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '')

  const appPort     = parseInt(env.APP_PORT)  || 3001
  const vitePort    = parseInt(env.VITE_PORT) || 5173
  // In Docker dev, VITE_PROXY_TARGET points to the server service by name
  const proxyTarget = env.VITE_PROXY_TARGET || `http://localhost:${appPort}`
  const usePolling  = env.VITE_USE_POLLING === 'true'

  return {
    plugins: [react()],
    server: {
      port: vitePort,
      host: true,  // required to expose Vite inside Docker
      watch: usePolling ? { usePolling: true, interval: 300 } : {},
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/setupTests.js',
    },
  }
})
