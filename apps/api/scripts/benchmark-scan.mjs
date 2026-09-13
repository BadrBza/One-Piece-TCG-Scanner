// Run from the repository root after pnpm build. Real API calls require --run.
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import sharp from 'sharp';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RecognitionService } from '../dist/recognition/recognition.service.js';
import { CardsService } from '../dist/cards/cards.service.js';
import { CardVariantsService } from '../dist/pricing/card-variants.service.js';
import { CardmarketProvider } from '../dist/pricing/providers/cardmarket.provider.js';

const manifestPath = process.argv[2];
const numberComparison = process.argv.includes('--number-comparison');
if (!manifestPath) throw new Error('Usage: node --env-file=.env apps/api/scripts/benchmark-scan.mjs manifest.json [--run]');
const cases = JSON.parse(await readFile(manifestPath, 'utf8'));
if (!Array.isArray(cases) || !cases.length) throw new Error('The manifest must contain labeled photographs. See docs/scanner-performance.md.');
const prepared = [];
for (const item of cases) {
  if (!item.id || !item.image || !item.cardNumber || !Number.isInteger(item.productId) || !['EN', 'JP', 'FR', 'CN', 'KR'].includes(item.language)) {
    throw new Error('Each case requires id, image, cardNumber, productId and language.');
  }
  const path = resolve(dirname(resolve(manifestPath)), item.image);
  const data = await readFile(path);
  const mediaType = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[extname(path).toLowerCase()];
  if (!mediaType || data.length > 7 * 1024 * 1024) throw new Error(`Unsupported photo: ${item.id}`);
  const oriented = await sharp(data).rotate().toBuffer();
  const { width, height } = await sharp(oriented).metadata();
  const left = Math.round(width * 0.4);
  const top = Math.round(height * 0.7);
  const cropWidth = width - left;
  const scale = Math.max(1, Math.min(3, 1800 / cropWidth));
  const crop = await sharp(oriented).extract({ left, top, width: cropWidth, height: height - top }).resize(Math.round(cropWidth * scale)).jpeg({ quality: 95 }).toBuffer();
  prepared.push({ ...item, photo: `data:${mediaType};base64,${data.toString('base64')}`, crop: `data:image/jpeg;base64,${crop.toString('base64')}` });
}
if (!process.argv.includes('--run')) {
  console.log(`${prepared.length} cases validated. Add --run to call Gemini and Cardmarket (billable Gemini requests).`);
  process.exit(0);
}
if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is required.');

let metrics = [];
Logger.overrideLogger({
  log(message) { try { const event = JSON.parse(message); if (event.stage) metrics.push(event); } catch {} },
  error() {}, warn() {}, debug() {}, verbose() {},
});
await mkdir('.cache/scanner-benchmarks', { recursive: true });
const directory = await mkdtemp(resolve('.cache/scanner-benchmarks/run-'));
const rows = [];
for (const [index, item] of prepared.entries()) {
  // Alternate order to reduce systematic model warm-up/time-of-day bias.
  for (const optimized of index % 2 ? [true, false] : [false, true]) {
    const cacheDirectory = await mkdtemp(join(directory, 'references-'));
    const config = new ConfigService({
      ...process.env, SCAN_OPTIMIZED: String(numberComparison || optimized), SCAN_CACHE_DIR: cacheDirectory,
      ...(numberComparison && !optimized ? { GEMINI_NUMBER_MODEL: 'gemini-3.5-flash', SCAN_NUMBER_REASONING: 'low' } : {}),
    });
    const cards = new CardsService(new RecognitionService(config), new CardmarketProvider(), new CardVariantsService(config));
    for (const cache of ['cold', 'warm']) {
      metrics = [];
      const start = performance.now();
      let result;
      let error;
      try { result = await cards.scan(item.photo, item.crop); } catch (reason) { error = reason.getStatus?.() ?? 'provider-error'; }
      const selected = result?.prices?.cardmarket?.selectedProductId;
      rows.push({
        id: item.id, optimized, cache, durationMs: Math.round(performance.now() - start),
        selectedProductId: selected ?? null,
        correctNumber: result?.card?.cardNumber === item.cardNumber,
        correctLanguage: result?.card?.language === item.language,
        correctSelection: selected === item.productId,
        wrongAutoSelection: selected !== undefined && selected !== item.productId,
        error, metrics: [...metrics],
      });
      console.log(`${item.id}: ${optimized ? 'optimized' : numberComparison ? 'number-baseline' : 'legacy'} / ${cache} completed`);
    }
  }
}
const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * p) - 1)];
const summary = [];
for (const optimized of [false, true]) for (const cache of ['cold', 'warm']) {
  const group = rows.filter(row => row.optimized === optimized && row.cache === cache);
  summary.push({
    optimized, cache, cases: group.length,
    medianMs: percentile(group.map(row => row.durationMs), 0.5),
    p95Ms: percentile(group.map(row => row.durationMs), 0.95),
    correctSelections: group.filter(row => row.correctSelection).length,
    wrongAutoSelections: group.filter(row => row.wrongAutoSelection).length,
    correctLanguages: group.filter(row => row.correctLanguage).length,
    errors: group.filter(row => row.error).length,
    successfulGenerations: group.flatMap(row => row.metrics).filter(event => event.model).length,
    inputTokens: group.flatMap(row => row.metrics).reduce((sum, event) => sum + (event.inputTokens ?? 0), 0),
    outputTokens: group.flatMap(row => row.metrics).reduce((sum, event) => sum + (event.outputTokens ?? 0), 0),
  });
}
const report = join(directory, 'report.json');
await writeFile(report, JSON.stringify({ createdAt: new Date().toISOString(), comparison: numberComparison ? 'number-model-and-reasoning' : 'full-pipeline', summary, rows }, null, 2));
console.table(summary);
console.log(`Report: ${report}`);
