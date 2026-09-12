import { z } from 'zod';

export const CredentialsSchema = z.object({
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(8).max(128),
});

export type Credentials = z.infer<typeof CredentialsSchema>;
export type AuthUser = { id: number; email: string };
