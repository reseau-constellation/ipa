import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import importPlugin, { rules } from 'eslint-plugin-import';

export default [
  {
    ignores: ["**/dist/**", "**/.vitepress/cache/**"],
  },
  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.typescript,
  {
    settings: {
      "import/resolver": {
        // Nécessitte https://github.com/import-js/eslint-import-resolver-typescript#configuration
        typescript: true,
        node: true,
      },
    },
    rules: {
      "import/order": [
        "warn",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index", "object", "type"]
        }
      ],
      "import/no-unresolved": "off",
    }
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,ts}"],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 12,
        sourceType: "module",
      },
    },
    ignores: ["**/node_modules/**", "**/dist/**", "**/coverage/**"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["*.{js,ts}"],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 12,
        sourceType: "module",
      },
      globals: {
        ...globals.node,
      },
    },
  },
];
