import { z } from 'zod';

export const CredentialsSchema = z.object({
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(8).max(128),
});

export const RegistrationSchema = CredentialsSchema.extend({
  nickname: z.string().trim().min(3).max(30).regex(/^[\p{L}\p{N}_ .-]+$/u),
  avatar: z.string().max(2_800_000).regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/).optional(),
});
export type Registration = z.infer<typeof RegistrationSchema>;

export const VerificationSchema = z.object({ code: z.string().regex(/^\d{6}$/) });

export type SessionTokens = {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number;
  expiresAt: number;
};

export type AuthenticatedSession = { user: AuthUser; tokens: SessionTokens };
export type PendingVerification = { status: 'verification_required'; email: string; emailSent: boolean };

export type Credentials = z.infer<typeof CredentialsSchema>;
export type AuthUser = { id: number; email: string; nickname: string | null; avatar: string | null };
