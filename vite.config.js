import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { offlineAssets } from './build/offlineAssets.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), offlineAssets()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
  }
})
