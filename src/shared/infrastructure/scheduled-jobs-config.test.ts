import { describe, expect, it } from "vite-plus/test";

import {
  assertRequiredEnvironment,
  scheduledJobs,
} from "src/shared/infrastructure/scheduled-jobs-config";

describe("scheduled jobs config に関するテスト", () => {
  it("collect-feedback を設定したとき、08:00 JST daily の cron になる", () => {
    // Arrange
    const job = scheduledJobs.find((item) => item.name === "collect-feedback");

    // Act
    const actual = job?.cron;

    // Assert
    expect(actual).toBe("0 23 * * *");
  });

  it("zenn-digest を設定したとき、09:00 JST daily の cron になる", () => {
    // Arrange
    const job = scheduledJobs.find((item) => item.name === "zenn-digest");

    // Act
    const actual = job?.cron;

    // Assert
    expect(actual).toBe("0 0 * * *");
  });

  it("suggest-feature-vocabulary を設定したとき、Saturday 08:30 JST の cron になる", () => {
    // Arrange
    const job = scheduledJobs.find((item) => item.name === "suggest-feature-vocabulary");

    // Act
    const actual = job?.cron;

    // Assert
    expect(actual).toBe("30 23 * * 5");
  });

  it("設定済み scheduled job 名を渡したとき、entrypoint 設定エラーにならない", () => {
    // Act
    const actual = () => assertRequiredEnvironment("zenn-digest");

    // Assert
    expect(actual).not.toThrow();
  });

  it("未設定の scheduled job 名を渡したとき、entrypoint 設定エラーにする", () => {
    // Arrange
    // Act
    const actual = () => assertRequiredEnvironment("unknown-job" as never);

    // Assert
    expect(actual).toThrow("unknown-job is not a configured scheduled job.");
  });
});
