import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';

import { AppModule } from './app.module.js';

const app = await NestFactory.create<NestFastifyApplication>(
  AppModule,
  new FastifyAdapter({
    bodyLimit: 14 * 1024 * 1024,
  }),
);

app.setGlobalPrefix('api');

app.enableCors({
  origin: [
    'http://localhost:5173',
  ],
});

await app.listen(
  Number(process.env.PORT ?? 3000),
  '0.0.0.0',
);

console.log('API running on http://localhost:3000');
