import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'formats',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
