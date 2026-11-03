const { defineConfig, configDefaults } = require('vitest/config');

module.exports = defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    setupFiles: ['./tests/setup.js'],
    testTimeout: 60000,
    hookTimeout: 120000,
    teardownTimeout: 30000,
    maxWorkers: 1,
  },
});
