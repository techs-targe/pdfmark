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
      sourcemap: false,
      rollupOptions: {
        output: {
          // Force .js extension instead of .mjs for worker files
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: (assetInfo) => {
            // Rename .mjs to .js for worker files
            if (assetInfo.name?.endsWith('.mjs')) {
              return 'assets/[name]-[hash].js'
            }
            return 'assets/[name]-[hash][extname]'
          }
        }
      }
    },
    optimizeDeps: {
      include: ['pdfjs-dist']
    },
    // Copy and rename worker file
    publicDir: 'public'
  }
})