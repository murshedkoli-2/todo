import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Node environment, no jsdom and no React plugin: everything under test here is
 * pure logic — money arithmetic, schemas, DTO mappers, the fetch wrapper. UI
 * behaviour is covered by the Playwright suite, where an assertion against a
 * real browser proves more than a jsdom render would.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      /*
       * Scoped to the pure-logic modules this suite actually exercises. Adding
       * a file here without a test for it lowers the reported number rather
       * than raising it, which is the intended pressure — the thresholds below
       * are a floor for code that claims to be covered, not a global average
       * diluted by React components the Playwright suite owns.
       */
      include: [
        "src/lib/money.ts",
        "src/lib/schemas/**",
        "src/lib/dto/**",
        "src/lib/imageType.ts",
        "src/lib/apiClient.ts",
        "src/lib/types.ts",
        "src/lib/dueDate.ts",
        "src/lib/quickAdd.ts",
        "src/lib/payment.ts",
        "src/lib/wizard.ts",
        "src/lib/serviceCatalogue.ts",
        "src/lib/subtasks.ts",
        "src/lib/taskStatus.ts",
        "src/lib/requestOrigin.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
