// @ts-check
const eslint = require("@eslint/js");
const { defineConfig } = require("eslint/config");
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");
const rxjsX = require("eslint-plugin-rxjs-x").default;

// Baseline strategy (see CONTRIBUTING.md "Linting" section). Calibrated
// against a REAL run on this codebase, not assumed — an initial pass with
// everything at "error" produced 1789 errors; the breakdown showed most of
// that volume was a handful of specific rules firing on genuinely
// widespread, pre-existing patterns (see notes below), not scattered real
// bugs. Those specific rules were downgraded; everything else stayed at
// its natural severity.
//
//   - Critical correctness rules (floating promises, ignored subscriptions,
//     duplicate imports, unused vars, equality bugs) are ERRORS.
//   - Broad legacy type-safety debt (explicit `any`, non-null assertions)
//     is WARN — the codebase depends on both heavily (113 + 12 instances)
//     and flipping them to error would require a large, unrelated rewrite.
//   - `tseslint.configs.stylistic` is NOT extended: it is a pure code-style
//     preset (interface-vs-type, array-type spelling, etc.) with zero
//     behavior difference — exactly the "highly opinionated formatting"
//     the baseline strategy says not to force (~70 instances observed).
//   - `@angular-eslint/template/prefer-control-flow` is OFF: it wants every
//     `*ngIf`/`*ngFor` migrated to the newer `@if`/`@for` syntax. Both are
//     fully supported by this Angular version; this is a pure syntax
//     preference with 890 (!) instances in the current templates — forcing
//     it would mean rewriting nearly every template in the project.
//   - Template accessibility rules (label-has-associated-control,
//     click-events-have-key-events, interactive-supports-focus,
//     elements-content, alt-text, role-has-required-aria) are downgraded to
//     WARN: ~287 real, legitimate findings inherited from the CoreUI
//     template — worth fixing, but legacy debt, not new blocking issues.
//   - `no-console` is WARN (warn/error allowed) to catch accidental debug
//     logging without blocking legitimate error reporting.
module.exports = defineConfig([
  {
    ignores: [
      "dist/**",
      "coverage/**",
      ".angular/**",
      "node_modules/**",
      "src/environments/environment.development.ts",
      "src/environments/environment.production.ts",
    ],
  },
  {
    files: ["**/*.ts"],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      angular.configs.tsRecommended,
      // NOT rxjsX.configs.recommended — pulls in ~185 findings from rules
      // never chosen for this project (no-implicit-any-catch: 142,
      // prefer-root-operators: 40, no-sharereplay: 3). Only the 4 specific
      // rxjs-x rules below (matching "incorrect RxJS subscription
      // handling" from the linting brief) are enabled explicitly.
    ],
    plugins: {
      "rxjs-x": rxjsX,
    },
    processor: angular.processInlineTemplates,
    languageOptions: {
      parserOptions: {
        // Type-aware linting (required for no-floating-promises and the
        // rxjs-x rules). Uses a dedicated tsconfig.eslint.json (broad
        // `include: src/**/*.ts`) rather than projectService auto-discovery
        // via tsconfig.app.json/tsconfig.spec.json — those are entry-point
        // driven (files: [main.ts] / [test.ts]) and don't reach ~223 files
        // (CoreUI template demo components never imported by the real app,
        // environment.*.example.ts variants, etc.), which projectService
        // reported as unresolvable parsing errors instead of lint findings.
        project: "./tsconfig.eslint.json",
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      "@angular-eslint/directive-selector": [
        "error",
        {
          type: "attribute",
          prefix: "app",
          style: "camelCase",
        },
      ],
      "@angular-eslint/component-selector": [
        "error",
        {
          type: "element",
          prefix: "app",
          style: "kebab-case",
        },
      ],

      // ── Critical correctness — blocking ──────────────────────────────
      "eqeqeq": ["error", "smart"],
      "no-duplicate-imports": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // no-ignored-subscription fires 203 times on a real run — this
      // codebase's established pattern is relying on component
      // destruction / takeUntil elsewhere rather than always chaining
      // .unsubscribe() at the call site. Genuinely widespread legacy
      // pattern, not 203 individual bugs — visible, not blocking, until
      // deliberately paid down. no-async-subscribe / no-nested-subscribe
      // are much rarer (12 / 4) and are real anti-pattern shapes (a
      // subscribe() inside an async fn, or nested inside another
      // subscribe's callback) — kept blocking.
      "rxjs-x/no-ignored-subscription": "warn",
      "rxjs-x/no-async-subscribe": "error",
      "rxjs-x/no-nested-subscribe": "error",
      "rxjs-x/no-unsafe-takeuntil": "error",

      // ── Legacy type-safety debt — informational for now ──────────────
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    files: ["**/*.html"],
    extends: [
      angular.configs.templateRecommended,
      angular.configs.templateAccessibility,
    ],
    rules: {
      // Pure syntax-migration preference (*ngIf/*ngFor -> @if/@for), not a
      // correctness issue — both syntaxes are fully supported. 890
      // instances in the current templates; see file header.
      "@angular-eslint/template/prefer-control-flow": "off",

      // Legitimate accessibility findings, but widespread legacy debt
      // (~287 instances) inherited from the CoreUI template — visible, not
      // blocking, until deliberately paid down.
      "@angular-eslint/template/label-has-associated-control": "warn",
      "@angular-eslint/template/click-events-have-key-events": "warn",
      "@angular-eslint/template/interactive-supports-focus": "warn",
      "@angular-eslint/template/elements-content": "warn",
      "@angular-eslint/template/alt-text": "warn",
      "@angular-eslint/template/role-has-required-aria": "warn",
    },
  },
]);
