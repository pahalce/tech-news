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
    expect(actual).toContain("permissions:\n  contents: write");
  });

  it("scheduled agent workflow を設定したとき、実装が対応する LLM provider env を渡す", async () => {
    // Arrange
    const workflowPath = join(
      import.meta.dirname,
      "../../.github/workflows/scheduled-agent-jobs.yml",
    );

    // Act
    const actual = await readFile(workflowPath, "utf8");

    // Assert
    expect(actual).toContain("LLM_PROVIDER: ${{ vars.LLM_PROVIDER }}");
    expect(actual).toContain("GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}");
    expect(actual).toContain(
      "GOOGLE_GENERATIVE_AI_API_KEY: ${{ secrets.GOOGLE_GENERATIVE_AI_API_KEY }}",
    );
    expect(actual).toContain("OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}");
    expect(actual).toContain("LLM_API_KEY: ${{ secrets.LLM_API_KEY }}");
    expect(actual).toContain("LLM_BASE_URL: ${{ vars.LLM_BASE_URL }}");
  });
});
