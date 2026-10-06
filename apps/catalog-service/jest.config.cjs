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
    'src/listings/listings.service.ts',
    'src/listings/listing-images.service.ts',
    'src/listings/image-file.validator.ts',
    'src/marketplace/marketplace-rules.service.ts',
  ],
  coverageDirectory: '../../coverage/catalog-service',
  coverageReporters: ['text', 'text-summary', 'json-summary', 'lcov'],
};
