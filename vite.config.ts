import { resolve } from "node:path";

import { defineConfig } from "vite-plus";

export default defineConfig({
  resolve: {
    alias: {
      src: resolve(import.meta.dirname, "src"),
    },
  },
  staged: {
    "*": "vp check --fix && pnpm check:architecture",
  },
  pack: {
    dts: {
      tsgo: true,
    },
    exports: true,
  },
  lint: {
    plugins: ["unicorn", "typescript", "oxc", "import"],
    rules: {
      "import/no-cycle": "error",
      "no-restricted-imports": "off",
    },
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
});
