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

export function elapsedMs(startedAt: number): number {
  return Math.round(performance.now() - startedAt);
}
