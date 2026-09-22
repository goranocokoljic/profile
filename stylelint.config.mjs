/** @type {import('stylelint').Config} */
export default {
  extends: ['stylelint-config-standard-scss'],
  rules: {
    // Token values are copied verbatim from the design reference so the
    // parity check can compare them as written.
    'color-hex-length': null,
    'value-keyword-case': ['lower', { ignoreProperties: ['/^--/'] }],
  },
};
