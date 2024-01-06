/* eslint-env node */
module.exports = {
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  root: true,
  ignorePatterns: ['**/node_modules/**', 'src/Receiptline/ESCPOS.js', 'src/ReceiptLine/RECEIPTLINE.js']
};
