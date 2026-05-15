import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    exclude: ['backend/dist/**', 'dist/**', 'node_modules/**', 'frontend/node_modules/**', 'frontend/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['backend/src/**/*.ts'],
      exclude: [
        'backend/src/**/*.test.ts',
        'backend/src/generated/**',
        'backend/src/config/**',
      ],
      thresholds: {
        statements: 60,
        branches: 60,
        functions: 60,
        lines: 60,
      },
    },
    alias: {
      '@': path.resolve(__dirname, './backend/src'),
    },
  },
});
