import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'developer.png'],
      devOptions: {
        enabled: false,
      },
      manifest: {
        name: 'Meal Manager',
        short_name: 'MealMgr',
        description: 'Rice Meal Management System',
        theme_color: '#10b981',
        background_color: '#f8fafc',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait',
        icons: [
          {
            src: 'logo.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'logo.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'logo.png',
            sizes: 'any',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    watch: {
      ignored: [
        '**/server/**',
        '**/auth_info_baileys/**',
        '**/*.vbs',
        '**/*.bat',
        '**/*.log'
      ]
    }
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1200,
    cssCodeSplit: true,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-firebase': ['firebase/compat/app', 'firebase/compat/auth', 'firebase/compat/firestore'],
          'vendor-pdf': ['jspdf', 'jspdf-autotable'],
          'vendor-ui': ['lucide-react', 'date-fns']
        }
      }
    }
  }
})