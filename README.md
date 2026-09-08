# OnePiece TCG Scanner

Application MVP pour scanner une carte One Piece TCG et recuperer une
estimation de prix depuis plusieurs sources.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: NestJS, Fastify, AI SDK, Gemini, Zod

## Architecture

```txt
apps/
  web/
    src/
      api/
      features/scanner/
        components/
      pages/
      App.tsx
      main.tsx

  api/
    src/
      cards/
      recognition/
      pricing/
      app.module.ts
      main.ts
```


Lancer pnpm dev puis ouvrir http://localhost:5173.

## Vérification

Compiler avec pnpm --filter @opscan/api build et pnpm --filter @opscan/web build.
Exécuter node --test apps/api/test/*.test.mjs.
Les tests IA simulent le transport HTTP et ne mesurent pas la précision visuelle.
