// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
 
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      // manifest sudah ada di public/manifest.json, tidak perlu duplikasi
      // Workbox: cache strategi untuk offline
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        runtimeCaching: [
          {
            // Cache API calls dari backend
            urlPattern: /^https:\/\/api\.ims\.trk-holding\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'trk-api-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 },
            }
          }
        ]
      }
    })
  ],

  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // ✅ Local backend
        changeOrigin: true,
        secure: false,
      }
    }
  }
})