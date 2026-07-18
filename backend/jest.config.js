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
  // regression. Ratchet these upward toward the 80% target as suites are added;
  // never lower them. Current: stmts ~72%, branches ~44%, lines ~75%, funcs ~65%.
  coverageThreshold: {
    global: {
      branches: 39,
      functions: 62,
      lines: 73,
      statements: 70,
    },
  },
  coverageDirectory: '<rootDir>/coverage',
  testTimeout: 30000,
  clearMocks: true,
};
