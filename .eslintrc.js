module.exports = {
  env: {
    browser: true,
    // es2021: true
  },
  extends: 'standard',
  overrides: [
    {
      env: {
        node: true
      },
      files: [
        '.eslintrc.{js,cjs}'
      ],
      parserOptions: {
        sourceType: 'script'
      }
    }
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    semi: [1, 'always'],
    "semi-spacing": 1,
    "space-unary-ops": 2,
    "space-unary-ops": true,
    "space-before-function-paren": 1,
    "space-in-parens": true,
    "space-infix-ops": true,
    "comma-spacing": 1,
    "key-spacing": true,
    "object-curly-spacing": true,
    "semi-spacing": true,
  }
}
