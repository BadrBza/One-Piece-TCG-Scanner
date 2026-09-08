import { fileURLToPath } from 'node:url';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, Output } from 'ai';
import { CardRecognitionSchema } from '../dist/schemas/card-recognition.schema.js';
import { IDENTIFY_CARD_PROMPT } from '../dist/prompts/identify-card.prompt.js';

process.loadEnvFile(fileURLToPath(new URL('../../../.env', import.meta.url)));
const modelId = process.argv[2] || process.env.GEMINI_MODEL || 'gemini-3.5-flash';
try {
  const result = await generateText({
    model: createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })(modelId),
    system: IDENTIFY_CARD_PROMPT,
    messages: [{ role: 'user', content: [{ type: 'text', text: 'Identifie cette carte à partir de la photo.' }, {
      type: 'file', mediaType: 'image/png',
      data: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5V8AAAAASUVORK5CYII=', 'base64'),
    }] }],
    output: Output.object({ schema: CardRecognitionSchema }),
    maxOutputTokens: 4096, maxRetries: 0, abortSignal: AbortSignal.timeout(45000),
  });
  console.log(JSON.stringify({ model: modelId, success: true, finishReason: result.finishReason, schemaValid: CardRecognitionSchema.safeParse(result.output).success }));
} catch (error) {
  const diagnostics = [];
  for (let current = error, depth = 0; current && depth < 6; current = current.lastError ?? current.cause, depth++) {
    diagnostics.push({
      name: /^[A-Za-z_]+$/.test(current.name ?? '') ? current.name : 'Other',
      status: typeof current.statusCode === 'number' ? current.statusCode : undefined,
      code: /^[A-Z_]+$/.test(current.code ?? '') ? current.code : undefined,
      invalidKey: /API_KEY_INVALID|API key not valid/i.test(current.responseBody ?? ''),
      network: /fetch failed|connect|network/i.test(current.message ?? ''),
      output: /output|schema|JSON/i.test(current.message ?? ''),
      finishReason: current.finishReason,
    });
  }
  console.log(JSON.stringify({ model: modelId, success: false, diagnostics }));
  process.exitCode = 1;
}
