// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/node_modules/', '**/dist/', '**/coverage/'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // CLAUDE.md section 5: no `any`, anywhere.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': 'allow-with-description' },
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      // Branded quantities are `number & { brand }`; this rule does not see
      // through the intersection and would forbid `-force` on a Newtons value.
      '@typescript-eslint/no-unsafe-unary-minus': 'off',
      // Numeric literals must be written in full; no implicit coercion tricks.
      'no-implicit-coercion': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
  {
    // The physics package must be pure and deterministic (CLAUDE.md section 5).
    files: ['packages/physics/src/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Physics must be deterministic. Use a seeded generator (CLAUDE.md section 5).',
        },
        {
          object: 'Date',
          property: 'now',
          message: 'Physics must be deterministic and must not depend on wall-clock time.',
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'packages/physics must not make network calls.' },
        { name: 'document', message: 'packages/physics must not touch the DOM.' },
        { name: 'window', message: 'packages/physics must not touch the DOM.' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', 'react/*'],
              message: 'packages/physics has no UI code.',
            },
            {
              group: ['node:*', 'fs', 'path', 'http', 'https', 'net'],
              message: 'packages/physics is pure: no I/O.',
            },
          ],
        },
      ],
    },
  },
  {
    // Plain JS config files are not part of any TypeScript project.
    files: ['**/*.js'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      // Tests legitimately use magic numbers from hand calculations and may need
      // non-null assertions on fixture data.
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
