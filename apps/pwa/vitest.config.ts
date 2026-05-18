import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [svelte(), svelteTesting()],
  resolve: {
    alias: {
      'virtual:pwa-register/svelte': resolve(__dirname, './src/__tests__/pwa-register-stub.ts')
    }
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,ts,svelte}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // Keep coverage enforcement aligned with the repository testing policy in AGENTS.md.
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 90,
        // App.svelte is still a large UI orchestrator, so branch coverage is
        // kept at the current floor until its state logic is extracted and
        // covered through smaller modules.
        branches: 64
      }
    }
  }
});
