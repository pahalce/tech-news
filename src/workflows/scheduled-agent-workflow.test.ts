import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";

describe("Scheduled Agent Workflow に関するテスト", () => {
  it("scheduled agent workflow を設定したとき、Agent State を Data Commit する", async () => {
    // Arrange
    const workflowPath = join(
      import.meta.dirname,
      "../../.github/workflows/scheduled-agent-jobs.yml",
    );

    // Act
    const actual = await readFile(workflowPath, "utf8");

    // Assert
    expect(actual).toContain("chore: persist agent state [skip ci]");
  });
});
