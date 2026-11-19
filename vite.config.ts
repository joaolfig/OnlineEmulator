import { resolve } from 'node:path';
import preact from '@preact/preset-vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // GitHub Pages serve o site em https://<usuario>.github.io/OnlineEmulator/
  base: '/OnlineEmulator/',
  plugins: [preact()],
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        host: resolve(import.meta.dirname, 'host.html'),
        play: resolve(import.meta.dirname, 'play.html'),
      },
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    environment: 'node',
  },
});
