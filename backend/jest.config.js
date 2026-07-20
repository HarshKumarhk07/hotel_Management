/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/tests/**',
    '!src/index.ts',
    '!src/config/swagger.ts',
    '!src/scripts/**',
  ],
  // Enforced coverage floor — set just below current actuals so CI fails on a
  // regression. Ratchet these upward toward the 80% target as suites are added.
  // Current actuals (2026-07-20): stmts ~65.82%, branches ~35.86%, lines ~68.46%, funcs ~59.78%
  coverageThreshold: {
    global: {
      branches: 34,
      functions: 58,
      lines: 67,
      statements: 64,
    },
  },
  coverageDirectory: '<rootDir>/coverage',
  testTimeout: 30000,
  clearMocks: true,
};
