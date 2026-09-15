import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { CardmarketCatalogSchema, CardmarketPriceGuideSchema } from '../cardmarket.schema.js';

// Same location from src/ and dist/, independent of the shell working directory.
const snapshotPath = fileURLToPath(new URL('../../../../../.cache/cardmarket/snapshot.json', import.meta.url));
const SnapshotSchema = z.object({
  version: z.literal(1),
  fetchedAt: z.number().int().positive().refine(value => value <= Date.now()),
  catalog: CardmarketCatalogSchema,
  guide: CardmarketPriceGuideSchema,
});
export type CardmarketSnapshot = z.infer<typeof SnapshotSchema>;

export async function readSnapshot(): Promise<CardmarketSnapshot | undefined> {
  try {
    return SnapshotSchema.parse(JSON.parse(await readFile(snapshotPath, 'utf8')));
  } catch { return undefined; }
}

export async function writeSnapshot(snapshot: CardmarketSnapshot): Promise<void> {
  const temporaryPath = `${snapshotPath}.${randomUUID()}.tmp`;
  await mkdir(dirname(snapshotPath), { recursive: true });
  try {
    await writeFile(temporaryPath, JSON.stringify(snapshot), 'utf8');
    await rename(temporaryPath, snapshotPath);
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}
