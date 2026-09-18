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
        // Fix untuk error "exceeding the limit": naikkan batas precache Workbox.
        // Default-nya 2 MB, bundle index-*.js kamu 2.1 MB jadi kepotong.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
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

  build: {
    // Pecah bundle jadi beberapa chunk supaya file utama tidak sebesar 2 MB+.
    // Sesuaikan daftar library di bawah dengan package.json kamu (cek nama
    // library XLSX/chart yang dipakai di ImportModal & Dashboard).
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // 'vendor-xlsx': ['xlsx'],
          // 'vendor-charts': ['recharts'], // ganti sesuai library chart yang dipakai
        }
      }
    },
    chunkSizeWarningLimit: 1000, // opsional: naikkan ambang warning Rollup (default 500kb)
  },

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
