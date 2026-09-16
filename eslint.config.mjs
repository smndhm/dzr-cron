import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // The worker in trigger/ runs on Cloudflare, not on Node, and the only
    // thing it borrows from that runtime is fetch.
    files: ['trigger/**/*.js'],
    languageOptions: {
      globals: { fetch: 'readonly' },
    },
  },
  {
    rules: {
      indent: ['error', 2],
      'linebreak-style': ['error', 'unix'],
      quotes: ['error', 'single'],
      semi: ['error', 'always'],
    },
  },
);
