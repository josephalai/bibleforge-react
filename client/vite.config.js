import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  // Load root-level .env so port config is shared with Docker Compose
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '')

  const appPort  = parseInt(env.APP_PORT)  || 3001
  const vitePort = parseInt(env.VITE_PORT) || 5173

  return {
    plugins: [react()],
    server: {
      port: vitePort,
      proxy: {
        '/api': {
          target: `http://localhost:${appPort}`,
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
