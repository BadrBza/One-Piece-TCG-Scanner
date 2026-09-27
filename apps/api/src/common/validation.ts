import { BadRequestException } from '@nestjs/common';
import type { z } from 'zod';

export function valider<T extends z.ZodType>(schema: T, valeur: unknown, message: string): z.infer<T> {
  const resultat = schema.safeParse(valeur);
  if (!resultat.success) throw new BadRequestException(message);
  return resultat.data;
}
