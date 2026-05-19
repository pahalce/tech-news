import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vite-plus/test";

import { resolve } from "./ts-extension-loader.mjs";

describe("TypeScript extension loader に関するテスト", () => {
  it.each([
    "src/jobs/collect-feedback.ts",
    "src/jobs/publish-recommendations.ts",
    "src/jobs/suggest-feature-vocabulary.ts",
  ])("src alias の job entrypoint %s を filesystem 上の file URL として解決する", async (job) => {
    const calls = [];

    const actual = await resolve(job, {}, async (specifier) => {
      calls.push(specifier);
      return { url: specifier };
    });

    const expectedUrl = pathToFileURL(`${process.cwd()}/${job}`).href;
    expect(actual.url).toBe(expectedUrl);
    expect(calls).toEqual([expectedUrl]);
  });

  it("src alias の拡張子なし import は .ts を補完して解決する", async () => {
    const attemptedSpecifiers = [];

    const actual = await resolve(
      "src/features/digest/presentation/run-zenn-digest",
      {},
      async (specifier) => {
        attemptedSpecifiers.push(specifier);
        return { url: specifier };
      },
    );

    const expectedUrl = pathToFileURL(
      `${process.cwd()}/src/features/digest/presentation/run-zenn-digest.ts`,
    ).href;
    expect(actual.url).toBe(expectedUrl);
    expect(attemptedSpecifiers).toEqual([expectedUrl]);
  });

  it("src alias の barrel import は index.ts にフォールバックして解決する", async () => {
    const attemptedSpecifiers = [];

    const actual = await resolve("src/domains/article", {}, async (specifier) => {
      attemptedSpecifiers.push(specifier);
      if (specifier.endsWith("/article.ts")) {
        throw new Error("article.ts does not exist");
      }

      return { url: specifier };
    });

    const expectedUrl = pathToFileURL(`${process.cwd()}/src/domains/article/index.ts`).href;
    expect(actual.url).toBe(expectedUrl);
    expect(attemptedSpecifiers).toEqual([
      pathToFileURL(`${process.cwd()}/src/domains/article.ts`).href,
      expectedUrl,
    ]);
  });

  it("file URL の .service のような dotted extensionless import は .ts を補完して解決する", async () => {
    const attemptedSpecifiers = [];
    const specifier = pathToFileURL(
      `${process.cwd()}/src/domains/article/article-extraction-registry.service`,
    ).href;

    const actual = await resolve(specifier, {}, async (nextSpecifier) => {
      attemptedSpecifiers.push(nextSpecifier);
      return { url: nextSpecifier };
    });

    const expectedUrl = `${specifier}.ts`;
    expect(actual.url).toBe(expectedUrl);
    expect(attemptedSpecifiers).toEqual([expectedUrl]);
  });
});
