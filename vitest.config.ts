import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    include: ['tests/**/*.test.{ts,tsx}'],
    pool: 'forks',
    maxForks: 4,
    minForks: 1,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['server/**/*.ts', 'src/lib/**/*.ts', 'src/stores/**/*.ts', 'src/services/**/*.ts', 'src/hooks/**/*.ts'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/*.d.ts', '**/*.config.*'],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
});
