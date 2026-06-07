import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  transformIgnorePatterns: ['/node_modules/'],

  // Coverage — consumed by SonarCloud in CI
  collectCoverageFrom: [
    'lib/**/*.ts',
    '!lib/**/*.d.ts',
  ],
  coverageReporters: ['lcov', 'text', 'clover'],
  coverageDirectory: 'coverage',
}

export default config
