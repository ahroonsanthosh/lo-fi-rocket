import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'physics',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Compile-time tests contain only type assertions; tsc checks them.
    exclude: ['**/*.types.test.ts'],
  },
});
