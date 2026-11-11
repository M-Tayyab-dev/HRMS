import { hash, verify } from '@node-rs/argon2';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { config } from '../config';

// OWASP-recommended Argon2id parameters (m=19 MiB, t=2, p=1).
const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (plain: string) => hash(plain, ARGON);

export async function verifyPassword(hashStr: string | null | undefined, plain: string): Promise<boolean> {
  if (!hashStr) {
    // Burn comparable time so missing accounts aren't distinguishable by timing.
    await hash(plain, ARGON);
    return false;
  }
  try {
    return await verify(hashStr, plain);
  } catch {
    return false;
  }
}

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
export const hmac = (v: string) => createHmac('sha256', config().DATA_HMAC_SECRET).update(v).digest('hex');

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
