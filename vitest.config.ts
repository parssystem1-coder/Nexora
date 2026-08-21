import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tools/**/*.spec.ts", "modules/**/*.spec.ts"],
    reporters: "default",
  },
});
