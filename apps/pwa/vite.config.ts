import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import mkcert from 'vite-plugin-mkcert';
import { execSync } from 'node:child_process';
import { version as packageVersion } from './package.json';

const base = process.env.VITE_BASE_URL || '/';
const manifestBase = process.env.VITE_APP_PATH || (base === './' ? '/' : base);
const buildVersion = packageVersion.trim();

function getLocalGitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

function formatBuildSha(sha: string, isDev: boolean): string {
  const shortSha = sha.slice(0, 7);

  return isDev ? `${shortSha}-dev` : shortSha;
}

const buildShaSource = (process.env.VITE_APP_VERSION || getLocalGitSha()).trim();
const buildSha = formatBuildSha(buildShaSource, !process.env.VITE_APP_VERSION);
const buildTime = (process.env.VITE_BUILD_TIME || new Date().toISOString()).trim();

export default defineConfig({
  base,
  server: {
    host: true
  },
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(buildVersion),
    'import.meta.env.VITE_APP_SHA': JSON.stringify(buildSha),
    'import.meta.env.VITE_BUILD_TIME': JSON.stringify(buildTime)
  },
  plugins: [
    svelte(),
    mkcert(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      devOptions: {
        enabled: true
      },
      manifest: {
        // Asset URLs can stay relative for Pages builds, but the installed app
        // identity and share target must point at the real app path.
        id: manifestBase,
        name: 'w1p',
        short_name: 'w1p',
        description: 'w1p dictionary PWA',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        screenshots: [
          {
            src: 'screenshots/desktop.png',
            sizes: '1280x720',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Desktop View'
          },
          {
            src: 'screenshots/mobile.png',
            sizes: '720x1280',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Mobile View'
          }
        ],
        share_target: {
          // Share target must resolve inside the installed app scope instead
          // of jumping to the origin root on subpath deployments.
          action: manifestBase,
          method: 'GET',
          enctype: 'application/x-www-form-urlencoded',
          params: {
            title: 'title',
            text: 'text',
            url: 'url'
          }
        }
      }
    })
  ]
});
