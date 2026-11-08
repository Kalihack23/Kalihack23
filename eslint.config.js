import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.browser } },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }], 'no-empty': ['error', { allowEmptyCatch: true }] },
  },
  {
    files: ['api/**/*.js', 'vite.config.js', 'eslint.config.js', 'tests/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node } },
    rules: { 'no-empty': ['error', { allowEmptyCatch: true }] },
  },
];
