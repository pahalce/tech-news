import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vite-plus/test";

import { checkArchitecture } from "./check-architecture";

describe("Architecture check に関するテスト", () => {
  it("workflow が module の application use case を import したとき、違反なしとなる", async () => {
    // Arrange
    const repositoryRoot = await mkdtemp(join(tmpdir(), "architecture-check-"));
    await writeProjectFile(
      repositoryRoot,
      "src/workflows/publish-recommendations-workflow.ts",
      'import { fetchArticle } from "../modules/article/application/fetch-article-use-case";\n\nvoid fetchArticle;\n',
    );
    await writeProjectFile(
      repositoryRoot,
      "src/modules/article/application/fetch-article-use-case.ts",
      "export function fetchArticle() {}\n",
    );

    // Act
    const actual = await checkArchitecture({ repositoryRoot });

    // Assert
    expect(actual).toHaveLength(0);
  });

  it("workflow が module の domain を import したとき、workflow orchestration 違反となる", async () => {
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
      expect.stringContaining("workflows may only import module application or infrastructure"),
    );
  });

  it("module barrel が作られたとき、layer 明示違反となる", async () => {
    // Arrange
    const repositoryRoot = await mkdtemp(join(tmpdir(), "architecture-check-"));
    await writeProjectFile(
      repositoryRoot,
      "src/modules/article/index.ts",
      'export { fetchArticle } from "./application/fetch-article-use-case";\n',
    );
    await writeProjectFile(
      repositoryRoot,
      "src/modules/article/application/fetch-article-use-case.ts",
      "export function fetchArticle() {}\n",
    );

    // Act
    const actual = await checkArchitecture({ repositoryRoot });

    // Assert
    expect(actual).toContainEqual(expect.stringContaining("module barrel index.ts is not allowed"));
  });

  it("別 module の domain を import したとき、cross-module domain coupling 違反となる", async () => {
    // Arrange
    const repositoryRoot = await mkdtemp(join(tmpdir(), "architecture-check-"));
    await writeProjectFile(
      repositoryRoot,
      "src/modules/recommendation/application/rank-articles-use-case.ts",
      'import { createCurrentFeedCandidate } from "../../article/domain/article";\n\nvoid createCurrentFeedCandidate;\n',
    );
    await writeProjectFile(
      repositoryRoot,
      "src/modules/article/domain/article.ts",
      "export function createCurrentFeedCandidate() {}\n",
    );

    // Act
    const actual = await checkArchitecture({ repositoryRoot });

    // Assert
    expect(actual).toContainEqual(
      expect.stringContaining("cross-module imports must target application layer"),
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
