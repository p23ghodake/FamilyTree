module.exports = {
  testEnvironment: 'jsdom',
  transform: { '^.+\\.[jt]sx?$': 'babel-jest' },
  moduleNameMapper: {
    '\\.(css)$': 'identity-obj-proxy',
    '\\.(woff2?|svg|png|jpe?g|gif)$': '<rootDir>/src/test/fileMock.js',
  },
};
