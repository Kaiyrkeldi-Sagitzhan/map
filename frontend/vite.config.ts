import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          const pkgPath = id.split('node_modules/')[1]
          if (!pkgPath) return 'vendor'

          const parts = pkgPath.split('/')
          const pkgName = parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0]

          return `vendor-${pkgName.replace('@', '').replace('/', '-')}`
        },
      },
    },
  },
  server: {
    port: 3000,
    host: true
  }
})
