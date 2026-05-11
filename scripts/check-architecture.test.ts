import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vite-plus/test";

import { checkArchitecture } from "./check-architecture";

describe("Architecture check に関するテスト", () => {
  it("workflow が module public API を import したとき、違反なしとなる", async () => {
    // Arrange
    const repositoryRoot = await mkdtemp(join(tmpdir(), "architecture-check-"));
    await writeProjectFile(
      repositoryRoot,
      "src/workflows/publish-recommendations-workflow.ts",
      'import { articleId } from "../modules/article";\n\nvoid articleId;\n',
    );
    await writeProjectFile(
      repositoryRoot,
      "src/modules/article/index.ts",
      'export const articleId = "article-id";\n',
    );

    // Act
    const actual = await checkArchitecture({ repositoryRoot });

    // Assert
    expect(actual).toHaveLength(0);
  });

  it("workflow が module 内部を import したとき、public API 違反となる", async () => {
    // Arrange
    const repositoryRoot = await mkdtemp(join(tmpdir(), "architecture-check-"));
    await writeProjectFile(
      repositoryRoot,
      "src/workflows/publish-recommendations-workflow.ts",
      'import { articleId } from "../modules/article/domain/article-id";\n\nvoid articleId;\n',
    );
    await writeProjectFile(
      repositoryRoot,
      "src/modules/article/domain/article-id.ts",
      'export const articleId = "article-id";\n',
    );

    // Act
    const actual = await checkArchitecture({ repositoryRoot });

    // Assert
    expect(actual).toContainEqual(
      expect.stringContaining("workflows must import modules through their public index.ts APIs"),
    );
  });

  it("domain が同一 module の application を import したとき、domain 依存違反となる", async () => {
    // Arrange
    const repositoryRoot = await mkdtemp(join(tmpdir(), "architecture-check-"));
    await writeProjectFile(
      repositoryRoot,
      "src/modules/article/domain/article.ts",
      'import { fetchArticle } from "../application/fetch-article-use-case";\n\nvoid fetchArticle;\n',
    );
    await writeProjectFile(
      repositoryRoot,
      "src/modules/article/application/fetch-article-use-case.ts",
      "export function fetchArticle() {}\n",
    );

    // Act
    const actual = await checkArchitecture({ repositoryRoot });

    // Assert
    expect(actual).toContainEqual(
      expect.stringContaining("domain code may only import same-module domain code"),
    );
  });

  it("application が同一 module の infrastructure を import したとき、application 依存違反となる", async () => {
    // Arrange
    const repositoryRoot = await mkdtemp(join(tmpdir(), "architecture-check-"));
    await writeProjectFile(
      repositoryRoot,
      "src/modules/article/application/fetch-article-use-case.ts",
      'import { httpArticleFetcher } from "../infrastructure/http-article-fetcher";\n\nvoid httpArticleFetcher;\n',
    );
    await writeProjectFile(
      repositoryRoot,
      "src/modules/article/infrastructure/http-article-fetcher.ts",
      'export const httpArticleFetcher = "http";\n',
    );

    // Act
    const actual = await checkArchitecture({ repositoryRoot });

    // Assert
    expect(actual).toContainEqual(
      expect.stringContaining("application code must not import infrastructure adapters"),
    );
  });
});

async function writeProjectFile(repositoryRoot: string, path: string, content: string) {
  const filePath = join(repositoryRoot, path);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content);
}
