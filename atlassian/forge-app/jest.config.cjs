/**
 * Jest config: restrict discovery to real test files only.
 * Prevents "No test suite found" for helper/runner TS files.
 */
module.exports = {
  testMatch: [
    "**/?(*.)+(test|spec).[tj]s?(x)"
  ],
};
