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
  ],
  coverageDirectory: '../../coverage/api',
  coverageReporters: [
    'text',
    'text-summary',
    'json-summary',
    'lcov',
  ],
  coverageThreshold: {
    './src/listings/listings.service.ts': {
      lines: 80,
      statements: 80,
    },
    './src/listings/listing-images.service.ts': {
      lines: 80,
      statements: 80,
    },
    './src/listings/image-file.validator.ts': {
      lines: 80,
      statements: 80,
    },
  },
};
