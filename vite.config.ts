import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png', 'songs.json', '_redirects'],
      manifest: {
        name: 'PartyAux · Autonomous Party DJ',
        short_name: 'PartyAux',
        description: 'Autonomous continuous party DJ web app with gapless mixing',
        theme_color: '#07060b',
        background_color: '#07060b',
        display: 'standalone',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/favicon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json}'],
        runtimeCaching: [
          {
            urlPattern: /\/songs\.json$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'partyaux-catalog',
            },
          },
          {
            urlPattern: /^https:\/\/(www\.)?youtube\.com\//,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\//,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
})
