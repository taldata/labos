import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
      },
      '/download': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
      },
      '/static': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
      },
      '/auth': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
      },
      '/mark_expense_': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
      },
      '/unmark_expense_': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
      },
      '/export_': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
      },
      '/health': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-router': ['react-router-dom'],
          'vendor-charts': ['recharts'],
        }
      }
    }
  },
  base: '/'
})
