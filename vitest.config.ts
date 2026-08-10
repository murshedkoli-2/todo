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
      include: [
        "src/lib/money.ts",
        "src/lib/schemas/**",
        "src/lib/dto/**",
        "src/lib/imageType.ts",
        "src/lib/apiClient.ts",
        "src/lib/types.ts",
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
