module.exports = {
  env: {
    node: true,
    es2021: true,
    mocha: true
  },
  extends: [
    'standard'
  ],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module'
  },
  rules: {
    // Standard indentation (2 spaces for source, 4 for tests)
    'indent': ['error', 2, { 'SwitchCase': 1 }],
    // Single quotes for source files
    'quotes': ['error', 'single', { 'avoidEscape': true }],
    // No semicolons (standard style)
    'semi': ['error', 'never'],
    // Allow function expressions (needed for Mocha tests)
    'prefer-arrow-callback': 'off',
    // Allow unused vars with underscore prefix
    'no-unused-vars': ['warn', { 'argsIgnorePattern': '^_' }],
    // Allow function declarations without space before parens
    'space-before-function-paren': ['error', {
      'anonymous': 'always',
      'named': 'never',
      'asyncArrow': 'always'
    }],
    // Allow multiple empty lines at end of file
    'no-multiple-empty-lines': ['error', { 'max': 2, 'maxEOF': 1 }],
    // Allow unused expressions in test assertions
    'no-unused-expressions': 'off'
  },
  overrides: [
    {
      files: ['test/**/*.js'],
      rules: {
        // 4-space indentation for test files (Mocha/Hardhat convention)
        'indent': ['error', 4, { 'SwitchCase': 1 }],
        // Double quotes for test files
        'quotes': ['error', 'double', { 'avoidEscape': true }],
        // Semicolons in test files
        'semi': ['error', 'always'],
        // More lenient rules for test files
        'no-unused-vars': 'off',
        'no-unused-expressions': 'off'
      }
    },
    {
      files: ['scripts/**/*.js'],
      rules: {
        // Scripts can use 4-space indentation (common in Hardhat scripts)
        'indent': ['error', 4],
        'quotes': ['error', 'double'],
        'semi': ['error', 'always']
      }
    }
  ]
}
