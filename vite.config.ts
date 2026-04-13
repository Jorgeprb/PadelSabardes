import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'padel-logo-192.png', 'padel-logo-512.png'],
      manifest: {
        name: 'Padel Sabardes',
        short_name: 'Sabardes',
        description: 'Gestión de Torneos Padel Sabardes',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'padel-logo-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'padel-logo-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          }
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // We will define specific push handling inside a custom sw via injectManifest if needed,
        // but for now, generateSW is fine for caching, we will use a separate firebase-messaging-sw.js
      },
      devOptions: {
        enabled: true,
      }
    })
  ],
});
