import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base lets the build work both on GitHub Pages (/alef-bet/) and from any static folder.
  base: './',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
