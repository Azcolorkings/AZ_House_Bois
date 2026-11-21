import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV, recommended for GCM
const TAG_LENGTH = 16;

/**
 * AES-256-GCM encryption for sensitive fields (SSN) at rest.
 * Key is derived from AUTH_SECRET (SHA-256) — the same secret Auth.js uses,
 * already set in Vercel. No new secret to manage.
 *
 * Format: base64(iv || authTag || ciphertext). Never log plaintext.
 */
function getKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not configured");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decryptSecret(blob: string): string {
  const key = getKey();
  const buf = Buffer.from(blob, "base64");
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

/** Normalize an SSN/EIN to digits only, for storage. */
export function normalizeSsn(raw: string): string {
  return String(raw ?? "").replace(/\D/g, "");
}

export function isValidSsn(raw: string): boolean {
  const digits = normalizeSsn(raw);
  // SSN (9 digits) or EIN (9 digits). Reject obvious fakes like all zeros.
  return digits.length === 9 && !/^0{9}$/.test(digits) && !/^1{9}$/.test(digits);
}

/** "123456789" -> "***-**-6789" — safe to show in status views. */
export function maskSsn(digits: string): string {
  const d = normalizeSsn(digits);
  if (d.length !== 9) return "***-**-****";
  return `***-**-${d.slice(5)}`;
}
