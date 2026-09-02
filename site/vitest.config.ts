// Vitest deliberately gets its own config (rather than a `test` block in
// vite.config.ts): the timeline tests are pure math/logic driven through the
// test seam — no browser, no DOM, no React plugin — so they run in the plain
// node environment with zero app plumbing loaded.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
