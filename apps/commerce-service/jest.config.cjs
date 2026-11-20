module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '/src/.*\.spec\.ts$',
  transform: {
    '^.+\.ts$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
      },
    ],
  },
  collectCoverageFrom: [
    'src/cart/cart.service.ts',
    'src/catalog/catalog-client.service.ts',
  ],
  coverageDirectory: '../../coverage/commerce-service',
  coverageReporters: ['text', 'text-summary', 'json-summary', 'lcov'],
};
