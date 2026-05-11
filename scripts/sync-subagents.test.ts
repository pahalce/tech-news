import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";

import { syncSubagents } from "./sync-subagents";

describe("Subagent 同期に関するテスト", () => {
  it("共通定義を同期したとき、Cursor 用 Markdown が生成される", async () => {
    // Arrange
    const repositoryRoot = await mkdtemp(join(tmpdir(), "sync-subagents-"));
    const sourceDir = join(repositoryRoot, ".agents", "agents");
    const cursorDir = join(repositoryRoot, ".cursor", "agents");
    const codexDir = join(repositoryRoot, ".codex", "agents");
    await mkdir(sourceDir, { recursive: true });
    await writeFile(
      join(sourceDir, "issue-manager.agent.md"),
      [
        "---",
        "name: issue-manager",
        "description: GitHub Issues operator.",
        "tools: [shell]",
        "cursor_model: auto",
        "codex_model: gpt-5.4-mini",
        "---",
        "",
        "Read `docs/agents/issue-tracker.md` before acting.",
        "",
      ].join("\n"),
    );

    // Act
    syncSubagents({ sourceDir, cursorDir, codexDir });
    const actual = await readFile(join(cursorDir, "issue-manager.md"), "utf8");

    // Assert
    expect(actual).toBe(
      [
        "---",
        "name: issue-manager",
        "description: GitHub Issues operator.",
        "model: auto",
        "---",
        "",
        "Read `docs/agents/issue-tracker.md` before acting.",
        "",
      ].join("\n"),
    );
  });

  it("Codex 用 model を指定した共通定義を同期したとき、Codex 用 TOML に codex_model の値が出力される", async () => {
    // Arrange
    const repositoryRoot = await mkdtemp(join(tmpdir(), "sync-subagents-"));
    const sourceDir = join(repositoryRoot, ".agents", "agents");
    const cursorDir = join(repositoryRoot, ".cursor", "agents");
    const codexDir = join(repositoryRoot, ".codex", "agents");
    await mkdir(sourceDir, { recursive: true });
    await writeFile(
      join(sourceDir, "domain-architect.agent.md"),
      [
        "---",
        "name: domain-architect",
        "description: Domain documentation scout.",
        "cursor_model: composer-2",
        "codex_model: gpt-5.5",
        "---",
        "",
        "Read `docs/agents/domain.md` first.",
        "",
      ].join("\n"),
    );

    // Act
    syncSubagents({ sourceDir, cursorDir, codexDir });
    const actual = await readFile(join(codexDir, "domain-architect.toml"), "utf8");

    // Assert
    expect(actual).toContain('model = "gpt-5.5"');
  });

  it("description がない共通定義を同期したとき、必須メタデータエラーとなる", async () => {
    // Arrange
    const repositoryRoot = await mkdtemp(join(tmpdir(), "sync-subagents-"));
    const sourceDir = join(repositoryRoot, ".agents", "agents");
    const cursorDir = join(repositoryRoot, ".cursor", "agents");
    const codexDir = join(repositoryRoot, ".codex", "agents");
    await mkdir(sourceDir, { recursive: true });
    await writeFile(
      join(sourceDir, "broken.agent.md"),
      ["---", "name: broken", "---", "", "Missing description.", ""].join("\n"),
    );

    // Act
    const actual = () => syncSubagents({ sourceDir, cursorDir, codexDir });

    // Assert
    expect(actual).toThrow("must define name and description");
  });
});
