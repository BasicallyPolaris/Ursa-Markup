import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

/** @type {import('eslint').Linter.Config[]} */
export default [
  { ignores: ["dist", "src-tauri/target"] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
    },
  },

  // Disable set-state-in-effect for files that intentionally use setState in useEffect
  // for initialization and state synchronization (e.g., zoom input syncing, settings loading, engine setup).
  // Also disable exhaustive-deps to allow optimized dependency arrays that prevent unnecessary re-renders.
  {
    files: [
      "src/components/toolbar/Toolbar.tsx",
      "src/contexts/DrawingContext.tsx",
      "src/contexts/CanvasEngineContext.tsx"
    ],
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/exhaustive-deps": "off"
    }
  },

  // Disable react-refresh warnings for UI components that may export constants alongside components
  {
    files: [
      "src/components/ui/button.tsx",
      "src/components/ui/toolbar-button.tsx"
    ],
    rules: {
      "react-refresh/only-export-components": "off"
    }
  },

  // Disable react-refresh warnings for context files, which legitimately export both
  // provider components and utility hooks (standard React context pattern)
  {
    files: [
      "src/contexts/*.tsx"
    ],
    rules: {
      "react-refresh/only-export-components": "off"
    }
  },

  // Disable explicit-any warnings for the settings utility, which uses 'any' in deepMerge
  // function for flexible object merging without overly complex generic constraints
  {
    files: [
      "src/utils/settings.ts"
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off"
    }
  }
];
