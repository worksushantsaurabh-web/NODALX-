module.exports = {
  env: {
    es6: true,
    node: true,
  },
  parserOptions: {
    "ecmaVersion": 2022,
  },
  extends: [
    "eslint:recommended",
    "google",
  ],
  rules: {
    "no-restricted-globals": ["error", "name", "length"],
    "prefer-arrow-callback": "error",
    "quotes": ["error", "double", {"allowTemplateLiterals": true}],
    "max-len": ["error", 120],
    // The mass-assignment guards (`const {id, createdAt, ...rest} = req.body`)
    // intentionally bind fields in order to drop them. Without this, eslint
    // flags the discarded names as unused and the safe version of that code
    // cannot be written.
    "no-unused-vars": ["error", {"ignoreRestSiblings": true}],
  },
  overrides: [
    {
      files: ["**/*.spec.*"],
      env: {
        mocha: true,
      },
      rules: {},
    },
  ],
  globals: {},
};
