import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix && node scripts/check-architecture.ts",
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
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "src/modules/*/domain/*",
                "src/modules/*/application/*",
                "src/modules/*/infrastructure/*",
                "@/modules/*/domain/*",
                "@/modules/*/application/*",
                "@/modules/*/infrastructure/*",
              ],
              message: "Import other modules through their public index.ts API.",
            },
          ],
        },
      ],
    },
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
});
