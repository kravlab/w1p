import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'
import mkcert from 'vite-plugin-mkcert'

export default defineConfig({
  server: {
    https: true,
    host: true
  },
  plugins: [
    svelte(),
    mkcert(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      devOptions: {
        enabled: true
      },
      manifest: {
        id: '/',
        name: 'My Svelte PWA',
        short_name: 'SveltePWA',
        description: 'My Svelte PWA Application',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'icons/icon-192.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'icons/icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable'
          }
        ],
        screenshots: [
          {
            src: 'https://placehold.co/1280x720/EEE/31343C.png?text=Desktop+View',
            sizes: '1280x720',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Desktop View'
          },
          {
            src: 'https://placehold.co/720x1280/EEE/31343C.png?text=Mobile+View',
            sizes: '720x1280',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Mobile View'
          }
        ],
        share_target: {
          action: "/share",
          method: "GET",
          enctype: "application/x-www-form-urlencoded",
          params: {
            title: "title",
            text: "text",
            url: "url"
          }
        }
      }
    })
  ],
})
