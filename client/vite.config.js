import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('crypto-js')) return 'crypto';
            if (id.includes('lucide-react') || id.includes('framer-motion')) return 'ui';
            return 'vendor';
          }
        }
      }
    }
  }
})