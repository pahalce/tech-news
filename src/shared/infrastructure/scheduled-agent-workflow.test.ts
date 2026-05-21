import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";

describe("Scheduled Agent Workflow に関するテスト", () => {
  it("scheduled agent workflow を設定したとき、Agent State を Data Commit する", async () => {
    // Arrange
    const workflowPath = join(
      import.meta.dirname,
      "../../../.github/workflows/scheduled-agent-jobs.yml",
    );

    // Act
    const actual = await readFile(workflowPath, "utf8");

    // Assert
    expect(actual).toContain("chore: persist agent state [skip ci]");
    expect(actual).toContain("permissions:\n  contents: write");
  });

  it("scheduled agent workflow を設定したとき、LLM secret だけを渡す", async () => {
    // Arrange
    const workflowPath = join(
      import.meta.dirname,
      "../../../.github/workflows/scheduled-agent-jobs.yml",
    );

    // Act
    const actual = await readFile(workflowPath, "utf8");

    // Assert
    expect(actual).toContain("GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}");
    expect(actual).toContain("OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}");
    expect(actual).toContain("LLM_API_KEY: ${{ secrets.LLM_API_KEY }}");
    expect(actual).not.toContain("LLM_PROVIDER:");
    expect(actual).not.toContain("LLM_BASE_URL:");
    expect(actual).not.toContain("LLM_MODEL:");
    expect(actual).not.toContain("LLM_REQUEST_TIMEOUT_MS:");
    expect(actual).not.toContain("HTTP_REQUEST_TIMEOUT_MS:");
  });

  it("workflow_dispatch で実行対象 job を選べる", async () => {
    // Arrange
    const workflowPath = join(
      import.meta.dirname,
      "../../../.github/workflows/scheduled-agent-jobs.yml",
    );

    // Act
    const actual = await readFile(workflowPath, "utf8");

    // Assert
    expect(actual).toContain('description: "Job to run"');
    expect(actual).toContain('default: "zenn-digest"');
    expect(actual).toContain("inputs.job == 'collect-feedback'");
    expect(actual).toContain("inputs.job == 'zenn-digest'");
    expect(actual).toContain("inputs.job == 'suggest-feature-vocabulary'");
    expect(actual).toContain("inputs.job == 'all'");
  });

  it("zenn-digest は GitHub schedule の遅延を見込んで早めに開始する", async () => {
    // Arrange
    const workflowPath = join(
      import.meta.dirname,
      "../../../.github/workflows/scheduled-agent-jobs.yml",
    );

    // Act
    const actual = await readFile(workflowPath, "utf8");

    // Assert
    expect(actual).toContain(
      "zenn-digest: starts at 05:00 JST daily so delayed GitHub schedules land near 09:00 JST",
    );
    expect(actual).toContain('cron: "0 20 * * *"');
    expect(actual).toContain("github.event.schedule == '0 20 * * *'");
    expect(actual).not.toContain("github.event.schedule == '0 0 * * *'");
  });
});
