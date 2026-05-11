import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { basename, join, resolve } from "node:path";

type AgentDefinition = {
  metadata: {
    name: string;
    description: string;
    model?: string;
    cursorModel?: string;
    codexModel?: string;
  };
  body: string;
  sourcePath: string;
};

type SyncSubagentsOptions = {
  sourceDir?: string;
  cursorDir?: string;
  codexDir?: string;
};

function parseAgentFile(sourcePath: string): AgentDefinition {
  const content = readFileSync(sourcePath, "utf8");
  const match = /^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/.exec(content);

  if (!match) {
    throw new Error(`${sourcePath} must start with YAML frontmatter`);
  }

  const frontmatter = match[1] ?? "";
  const body = match[2] ?? "";
  const metadata: Record<string, string> = {};

  for (const line of frontmatter.split("\n")) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (key === "tools") {
      continue;
    }

    metadata[key] = value;
  }

  if (!metadata.name || !metadata.description) {
    throw new Error(`${sourcePath} must define name and description`);
  }

  return {
    metadata: {
      name: metadata.name,
      description: metadata.description,
      model: metadata.model,
      cursorModel: metadata.cursor_model,
      codexModel: metadata.codex_model,
    },
    body: body.trimEnd(),
    sourcePath,
  };
}

function toCursorMarkdown(agent: AgentDefinition): string {
  const cursorModel = agent.metadata.cursorModel ?? agent.metadata.model;
  const frontmatter = [
    "---",
    `name: ${agent.metadata.name}`,
    `description: ${agent.metadata.description}`,
    cursorModel ? `model: ${cursorModel}` : undefined,
    "---",
  ].filter(Boolean);

  return `${frontmatter.join("\n")}\n\n${agent.body}\n`;
}

function toTomlString(value: string): string {
  return JSON.stringify(value);
}

function toTomlMultiline(value: string): string {
  return `"""\n${value.replaceAll('"""', '\\"\\"\\"')}\n"""`;
}

function toCodexToml(agent: AgentDefinition): string {
  const codexModel = agent.metadata.codexModel ?? agent.metadata.model;
  const lines = [
    `name = ${toTomlString(agent.metadata.name)}`,
    `description = ${toTomlString(agent.metadata.description)}`,
  ];

  if (codexModel && codexModel !== "inherit") {
    lines.push(`model = ${toTomlString(codexModel)}`);
  }

  lines.push(`developer_instructions = ${toTomlMultiline(agent.body)}`);

  return `${lines.join("\n")}\n`;
}

export function syncSubagents(options: SyncSubagentsOptions = {}) {
  const sourceDir = options.sourceDir ?? ".agents/agents";
  const cursorDir = options.cursorDir ?? ".cursor/agents";
  const codexDir = options.codexDir ?? ".codex/agents";

  mkdirSync(cursorDir, { recursive: true });
  mkdirSync(codexDir, { recursive: true });

  for (const fileName of readdirSync(sourceDir).sort()) {
    if (!fileName.endsWith(".agent.md")) {
      continue;
    }

    const agent = parseAgentFile(join(sourceDir, fileName));
    const outputName = basename(fileName, ".agent.md");

    writeFileSync(join(cursorDir, `${outputName}.md`), toCursorMarkdown(agent));
    writeFileSync(join(codexDir, `${outputName}.toml`), toCodexToml(agent));
  }
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  syncSubagents();
}
