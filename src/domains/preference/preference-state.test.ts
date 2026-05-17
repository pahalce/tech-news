import { describe, expect, it } from "vite-plus/test";

import { parsePreferenceProfile } from "src/domains/preference";

describe("Preference Profile に関するテスト", () => {
  it("Article Feature Vocabulary Keys の topic と feature axis に一致すると parse できる", () => {
    // Act
    const actual = parsePreferenceProfile(createProfile(), {
      topicKeys: ["typescript"],
      featureAxisKeys: {
        content_types: ["implementation_guide"],
      },
    });

    // Assert
    expect(actual.feature_weights.topics.typescript).toBe(0.2);
  });

  it("Article Feature Vocabulary Keys にない feature axis があると失敗する", () => {
    // Act & Assert
    expect(() =>
      parsePreferenceProfile(createProfile(), {
        topicKeys: ["typescript"],
        featureAxisKeys: {},
      }),
    ).toThrow(
      "Preference Profile feature_weights.feature_axes.content_types is not defined in Feature Vocabulary.",
    );
  });
});

function createProfile() {
  return {
    version: 1,
    weight_range: { min: -1, max: 1 },
    seed_weight_range: { min: -0.5, max: 0.5 },
    feature_weights: {
      topics: { typescript: 0.2 },
      feature_axes: {
        content_types: { implementation_guide: 0.3 },
      },
    },
    updated_at: "2026-05-14T00:00:00.000Z",
  };
}
