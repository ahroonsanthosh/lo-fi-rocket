import { defineConfig } from 'vitest/config';

/** The built server and extension, run as Claude Code and Claude Desktop run them (plan 0062 part 3). */
export default defineConfig({
  test: {
    name: 'mcp-smoke',
    environment: 'node',
    include: ['smoke/**/*.test.ts'],
    testTimeout: 30_000,
  },
});
