import type { WorkflowLogFields, WorkflowLogger } from "src/shared/application/workflow-logger";
export {
  elapsedMs,
  silentWorkflowLogger,
  type WorkflowLogFields,
  type WorkflowLogger,
} from "src/shared/application/workflow-logger";

export function createConsoleWorkflowLogger(scope: string): WorkflowLogger {
  return {
    info: (message, fields) => console.info(formatLogLine("info", scope, message, fields)),
    warn: (message, fields) => console.warn(formatLogLine("warn", scope, message, fields)),
    error: (message, fields) => console.error(formatLogLine("error", scope, message, fields)),
  };
}

function formatLogLine(
  level: "info" | "warn" | "error",
  scope: string,
  message: string,
  fields?: WorkflowLogFields,
): string {
  const suffix = fields ? ` ${JSON.stringify(removeUndefined(fields))}` : "";
  return `[${new Date().toISOString()}] ${level.toUpperCase()} ${scope}: ${message}${suffix}`;
}

function removeUndefined(fields: WorkflowLogFields): WorkflowLogFields {
  return Object.fromEntries(
    Object.entries(fields).filter((entry): entry is [string, unknown] => entry[1] !== undefined),
  );
}
