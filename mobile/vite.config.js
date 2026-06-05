import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'icons/icon.svg'],
      manifest: {
        name: 'M&E Fresh Eggs',
        short_name: 'M&E Eggs',
        description: 'Egg inventory, sales, expenses & delivery tracker',
        theme_color: '#2E7D32',
        background_color: '#F5F7F0',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '/M-EFresheggs/mobile/',
        icons: [
          {
            src: 'logo.png',
            sizes: 'any',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/npohyeqnaltpqzmmlmej\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24,
              },
            },
          },
        ],
      },
    }),
  ],
  base: '/M-EFresheggs/mobile/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
