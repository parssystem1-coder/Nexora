import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tools/**/*.spec.ts", "modules/**/*.spec.ts", "platform/**/*.spec.ts"],
    reporters: "default",
  },
});
