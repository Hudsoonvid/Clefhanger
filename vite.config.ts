import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative base so the build works from any static host (GitHub Pages, a subfolder, a USB stick).
  base: './',
  plugins: [react()],
  build: {
    // The main chunk embeds the Bravura music font (~600 kB) so no font is fetched from a CDN.
    chunkSizeWarningLimit: 1200,
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
});
