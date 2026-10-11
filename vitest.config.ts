import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Each package under packages/ is its own Vitest project (see its vitest.config.ts).
    projects: ['packages/*'],
    // Phase 1 only has tests in packages/physics; formats and app have none yet.
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.{ts,tsx}'],
      exclude: ['**/*.test.ts', '**/*.test.tsx', 'packages/app/src/main.tsx'],
    },
  },
});
