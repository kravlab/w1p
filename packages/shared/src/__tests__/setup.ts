/**
 * Global setup for Vitest in the shared package.
 * Extends Vitest with jest-dom matchers and handles cleanup after each test.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/svelte';
import { afterEach } from 'vitest';

/**
 * Automatically clean up the DOM after each test to prevent side effects.
 */
afterEach(() => {
  cleanup();
  localStorage.clear();
});
