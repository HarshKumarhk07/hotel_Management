/* ESLint config for the backend (TypeScript, Node, ESLint 8 / eslintrc). */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: { node: true, es2022: true },
  ignorePatterns: ['dist', 'node_modules', 'coverage', '*.cjs', 'jest.config.js'],
  rules: {
    // `any` is used deliberately in a few typed-escape hatches; keep it allowed
    // but visible as a warning rather than a hard error.
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
    ],
    'no-console': ['warn', { allow: ['error', 'warn'] }],
    'no-await-in-loop': 'off',
  },
  overrides: [
    {
      files: ['src/tests/**/*.ts', '**/*.test.ts'],
      env: { jest: true },
      rules: { '@typescript-eslint/no-explicit-any': 'off' },
    },
  ],
};
