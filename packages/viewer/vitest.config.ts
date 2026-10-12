import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'viewer',
    // three.js core (geometry, matrices, quaternions) runs without a DOM; src/dom is not tested here.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
