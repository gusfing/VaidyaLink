module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.js', '!src/**/*.test.js', '!src/**/__tests__/**'],
  testMatch: ['**/__tests__/**/*.js', '**/*.test.js'],
  verbose: true,
};
