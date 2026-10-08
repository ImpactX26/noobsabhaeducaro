/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\.spec\.ts$',
  transform: { '^.+\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }] },
  testEnvironment: 'node',
  // API specs boot the whole app against PostgreSQL (and hash passwords): allow for parallel-worker load
  testTimeout: 30000,
  setupFiles: ['<rootDir>/testing/jest.setup.ts'],
};
