/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/harnkan/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon-180.png'],
      manifest: {
        name: 'หารกัน',
        short_name: 'หารกัน',
        description: 'แอพหารค่าอาหารและสร้าง QR PromptPay ออฟไลน์',
        start_url: '/harnkan/',
        scope: '/harnkan/',
        display: 'standalone',
        theme_color: '#007AFF',
        background_color: '#F2F2F7',
        lang: 'th',
        icons: [
          { src: '/harnkan/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/harnkan/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,json}'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    globals: false,
  },
})
