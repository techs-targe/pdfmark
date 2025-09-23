import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, mkdirSync, existsSync, cpSync } from 'fs'
import { resolve } from 'path'

// Plugin to copy PDF.js assets with Japanese support
function copyPdfJsAssets() {
  return {
    name: 'copy-pdfjs-assets',
    buildStart() {
      // Ensure public directory exists
      if (!existsSync('public')) {
        mkdirSync('public', { recursive: true })
      }

      try {
        // Copy PDF worker
        const workerSrc = resolve('node_modules/pdfjs-dist/build/pdf.worker.min.mjs')
        const workerDest = resolve('public/pdf.worker.min.mjs')
        if (existsSync(workerSrc)) {
          copyFileSync(workerSrc, workerDest)
          console.log('✅ PDF.js worker copied to public/')
        }

        // Copy CMap files for Japanese text support
        const cmapSrc = resolve('node_modules/pdfjs-dist/cmaps')
        const cmapDest = resolve('public/cmaps')
        if (existsSync(cmapSrc)) {
          cpSync(cmapSrc, cmapDest, { recursive: true })
          console.log('✅ CMap files copied for Japanese text support')
        }

        // Copy standard fonts
        const fontSrc = resolve('node_modules/pdfjs-dist/standard_fonts')
        const fontDest = resolve('public/standard_fonts')
        if (existsSync(fontSrc)) {
          cpSync(fontSrc, fontDest, { recursive: true })
          console.log('✅ Standard fonts copied')
        }
      } catch (error) {
        console.warn('⚠️  PDF.js assets copy failed:', error.message)
      }
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [
      react(),
      copyPdfJsAssets()
    ],
    define: {
      __BUILD_DATE__: JSON.stringify(new Date().toISOString().split('T')[0])
    },
    // Use base path from environment variable, default to relative path for GitHub Pages
    base: env.VITE_BASE_PATH || './',
    server: {
      port: 4567,
      host: '0.0.0.0',
      open: true,
      // Add MIME type for .bcmap files
      middlewareMode: false,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization'
      }
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