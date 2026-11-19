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
    files: ['src/ui/**/*.tsx'],
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
              group: ['**/adapters/**', '**/app/**', '**/ui/**'],
              message: 'core/ não pode importar outras camadas.',
            },
            {
              group: ['peerjs', 'preact', 'preact/*', '@preact/*', 'idb'],
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
            { group: ['**/app/**', '**/ui/**'], message: 'adapters/ não podem importar app/ nem ui/.' },
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
