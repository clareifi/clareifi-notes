import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Node 20 exposes globalThis.crypto with crypto.subtle — no polyfill needed.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
