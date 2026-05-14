export type WorkflowLogFields = Record<string, unknown>;

export type WorkflowLogger = {
  info(message: string, fields?: WorkflowLogFields): void;
  warn(message: string, fields?: WorkflowLogFields): void;
  error(message: string, fields?: WorkflowLogFields): void;
};

export const silentWorkflowLogger: WorkflowLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

export function createConsoleWorkflowLogger(scope: string): WorkflowLogger {
  return {
    info: (message, fields) => console.info(formatLogLine("info", scope, message, fields)),
    warn: (message, fields) => console.warn(formatLogLine("warn", scope, message, fields)),
    error: (message, fields) => console.error(formatLogLine("error", scope, message, fields)),
  };
}

export function elapsedMs(startedAt: number): number {
  return Math.round(performance.now() - startedAt);
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
