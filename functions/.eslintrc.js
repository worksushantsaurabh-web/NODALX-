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
      // The uncommitted workspace feature is formatted with Prettier while the
      // legacy Functions code uses Google ESLint formatting. Keep correctness
      // rules active now; schedule a style-only cleanup before this feature is
      // promoted to a release.
      files: [
        "lib/billing.js",
        "lib/importRecipes.integration.test.js",
        "lib/importRecipes.js",
        "lib/importRecipes.rules.test.js",
        "lib/plans.js",
        "lib/plans.test.js",
        "lib/recipes.js",
        "lib/recipes.test.js",
        "lib/sheetWorkspace.js",
        "lib/uploadWorkspace.js",
        "lib/uploadWorkspace.test.js",
        "lib/workspace.integration.test.js",
        "lib/workspace.js",
        "lib/workspaceRoutes.js",
        "lib/automation.js",
        "lib/automation.test.js",
        "lib/automation.integration.test.js",
      ],
      rules: {
        "curly": "off",
        "indent": "off",
        "max-len": "off",
        "new-cap": "off",
        "object-curly-spacing": "off",
        "operator-linebreak": "off",
        "quote-props": "off",
        "comma-spacing": "off",
        "require-jsdoc": "off",
      },
    },
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
