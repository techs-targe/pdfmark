import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [react()],
    // Use base path from environment variable, default to '/'
    base: env.VITE_BASE_PATH || '/',
    server: {
      port: 4567,
      host: '0.0.0.0',
      open: true
    },
    build: {
      outDir: 'dist',
      sourcemap: false
    },
    optimizeDeps: {
      include: ['pdfjs-dist']
    }
  }
})