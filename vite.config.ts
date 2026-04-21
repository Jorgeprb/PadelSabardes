import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      filename: 'sw.js',
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
        importScripts: ['firebase-messaging-sw.js'],
      },
      devOptions: {
        enabled: true,
      }
    })
  ],
});
