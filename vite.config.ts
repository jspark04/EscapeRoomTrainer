/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
    // Some generator tests brute-force the puzzle space across many seeds, which
    // can exceed the 5s default on slower CI runners. Generating a single puzzle
    // is still milliseconds; this only relaxes the test-runner ceiling.
    testTimeout: 20000,
  },
});
