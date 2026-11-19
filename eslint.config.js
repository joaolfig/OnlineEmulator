import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'spike/', 'playwright-report/', 'test-results/'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    // As regras de hooks valem para Preact também (mesmos nomes: useEffect, useMemo…).
    files: ['src/ui/**/*.tsx', 'src/lab/**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'Nunca insira HTML vindo da rede (risco de XSS).',
        },
      ],
    },
  },
  {
    // core/ é puro: não pode depender de adapters, app, ui nem de bibliotecas de browser.
    files: ['src/core/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/adapters/**', '**/app/**', '**/ui/**', '**/lab/**'],
              message: 'core/ não pode importar outras camadas.',
            },
            {
              group: ['peerjs', 'preact', 'preact/*', '@preact/*', 'idb', 'three', 'three/*'],
              message: 'core/ não pode depender de bibliotecas de browser/UI.',
            },
          ],
        },
      ],
    },
  },
  {
    // adapters/ não conhecem a orquestração nem a UI.
    files: ['src/adapters/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/app/**', '**/ui/**', '**/lab/**'],
              message: 'adapters/ não podem importar app/ nem ui/.',
            },
          ],
        },
      ],
    },
  },
  {
    // O laboratório de visual é experimental: o app de verdade nunca depende dele (nem do three.js).
    files: [
      'src/app/**',
      'src/ui/**',
      'src/config.ts',
      'src/entries/host.tsx',
      'src/entries/play.tsx',
      'src/entries/landing.tsx',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['**/lab/**'], message: 'O app principal não pode usar o laboratório de visual.' },
            { group: ['three', 'three/*'], message: 'three.js é só do laboratório.' },
          ],
        },
      ],
    },
  },
  {
    files: ['*.config.{js,ts}', 'tests/**'],
    languageOptions: { globals: { ...globals.node } },
  },
);
