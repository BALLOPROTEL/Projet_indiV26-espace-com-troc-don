module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '/src/.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
      },
    ],
  },
  collectCoverageFrom: [
    'src/marketplace/marketplace-rules.service.ts',
    'src/proposals/proposals.service.ts',
    'src/transactions/transactions.service.ts',
    'src/catalog/catalog-client.service.ts',
  ],
  coverageDirectory: '../../coverage/marketplace-service',
  coverageReporters: ['text', 'text-summary', 'json-summary', 'lcov'],
};
