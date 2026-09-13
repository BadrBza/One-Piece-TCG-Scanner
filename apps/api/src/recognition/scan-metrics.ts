import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';

const context = new AsyncLocalStorage<{ scanId: string }>();
const logger = new Logger('ScanMetrics');

export function scanContext<T>(run: () => Promise<T>) {
  return context.run({ scanId: randomUUID() }, () => measureScan('total', run));
}

export async function measureScan<T>(stage: string, run: () => Promise<T>): Promise<T> {
  const start = performance.now();
  let success = false;
  try {
    const result = await run();
    success = true;
    return result;
  } finally {
    logger.log(JSON.stringify({ ...context.getStore(), stage, durationMs: Math.round(performance.now() - start), success }));
  }
}

export function scanTelemetry(stage: string) {
  return { isEnabled: true, recordInputs: false, recordOutputs: false, functionId: `scanner.${stage}` };
}

export function recordUsage(stage: string, usage: { inputTokens?: number; outputTokens?: number }, model: string) {
  logger.log(JSON.stringify({ ...context.getStore(), stage, model, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens }));
}
