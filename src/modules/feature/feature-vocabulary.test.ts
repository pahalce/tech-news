import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";

import { loadFeatureVocabularyConfig } from "./infrastructure/file-feature-vocabulary-config";

describe("Feature Vocabulary Config に関するテスト", () => {
  it("既定 config を読み込んだとき、topic alias を大文字小文字を無視して canonical Topic Key に正規化できる", async () => {
    // Arrange
    const repositoryRoot = undefined;

    // Act
    const vocabulary = await loadFeatureVocabularyConfig(repositoryRoot);

    // Assert
    expect(vocabulary.normalizeTopic("NEXT.JS")).toEqual({
      kind: "known_topic",
      topicKey: "nextjs",
      displayName: "Next.js",
    });
  });

  it("未知の topic を正規化したとき、Unknown Topic として lowercase の候補を返す", async () => {
    // Arrange
    const vocabulary = await loadFeatureVocabularyConfig();

    // Act
    const actual = vocabulary.normalizeTopic("Rust");

    // Assert
    expect(actual).toEqual({
      kind: "unknown_topic",
      normalizedTopic: "rust",
    });
  });

  it("Topic Key が lowercase でないとき、config 検証エラーとなる", async () => {
    // Arrange
    const repositoryRoot = await createRepositoryWithFeatureVocabulary({
      version: 1,
      topics: {
        TypeScript: {
          display_name: "TypeScript",
          aliases: ["typescript"],
          description_ja: "JavaScript に静的型付けを加えたプログラミング言語",
        },
      },
      feature_axes: {
        content_types: {
          description_ja: "記事の形式や構成",
          features: {
            implementation_guide: {
              description_ja: "特定の実装を進めるための手順やガイド",
            },
          },
        },
      },
    });

    // Act
    const actual = loadFeatureVocabularyConfig(repositoryRoot);

    // Assert
    await expect(actual).rejects.toThrow("key must be lowercase");
  });

  it("Feature Axis が既定の6軸以外のとき、config 検証エラーとなる", async () => {
    // Arrange
    const repositoryRoot = await createRepositoryWithFeatureVocabulary({
      version: 1,
      topics: {
        typescript: {
          display_name: "TypeScript",
          aliases: ["typescript"],
          description_ja: "JavaScript に静的型付けを加えたプログラミング言語",
        },
      },
      feature_axes: {
        quality_signals: {
          description_ja: "記事の品質",
          features: {
            deep_article: {
              description_ja: "深い記事",
            },
          },
        },
      },
    });

    // Act
    const actual = loadFeatureVocabularyConfig(repositoryRoot);

    // Assert
    await expect(actual).rejects.toThrow("quality_signals is not a supported Feature Axis");
  });

  it("同じ topic alias を複数の Topic Key が持つとき、config 検証エラーとなる", async () => {
    // Arrange
    const repositoryRoot = await createRepositoryWithFeatureVocabulary({
      version: 1,
      topics: {
        typescript: {
          display_name: "TypeScript",
          aliases: ["ts", "typescript"],
          description_ja: "JavaScript に静的型付けを加えたプログラミング言語",
        },
        testing: {
          display_name: "Testing",
          aliases: ["test", "ts"],
          description_ja: "品質を検証するためのテスト設計、実装、自動化",
        },
      },
      feature_axes: {
        content_types: {
          description_ja: "記事の形式や構成",
          features: {
            implementation_guide: {
              description_ja: "特定の実装を進めるための手順やガイド",
            },
          },
        },
      },
    });

    // Act
    const actual = loadFeatureVocabularyConfig(repositoryRoot);

    // Assert
    await expect(actual).rejects.toThrow(
      "Topic alias ts is already used by typescript and cannot be used by testing",
    );
  });
});

async function createRepositoryWithFeatureVocabulary(featureVocabulary: unknown) {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "flue-feature-vocabulary-"));
  await mkdir(join(repositoryRoot, "config"));
  await writeFile(
    join(repositoryRoot, "config", "feature-vocabulary.json"),
    `${JSON.stringify(featureVocabulary, null, 2)}\n`,
  );
  return repositoryRoot;
}
