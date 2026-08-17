import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { getEnv } from "@/lib/env";

/**
 * AES-256-GCM encryption for per-org integration secrets
 * (integration_settings.*_encrypted columns). Server-only.
 *
 * Key: SECRETS_ENCRYPTION_KEY — 32 bytes, base64. Generate with:
 *   node -e "console.log(crypto.randomBytes(32).toString('base64'))"
 *
 * Ciphertext format: base64(iv[12] || authTag[16] || ciphertext)
 */

function getKey(): Buffer | null {
  const raw = getEnv().SECRETS_ENCRYPTION_KEY;
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("SECRETS_ENCRYPTION_KEY must be 32 bytes, base64-encoded.");
  }
  return key;
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  if (!key) {
    throw new Error(
      "SECRETS_ENCRYPTION_KEY is required to store integration secrets (see .env.example).",
    );
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}

/** Returns null (never throws) when the key is missing or data is invalid. */
export function decryptSecret(ciphertext: string | null | undefined): string | null {
  if (!ciphertext) return null;
  const key = getKey();
  if (!key) {
    // TODO: set SECRETS_ENCRYPTION_KEY to read per-org secrets; adapters
    // fall back to env creds or dry-run.
    console.warn("[dry-run] SECRETS_ENCRYPTION_KEY missing — cannot decrypt org secrets.");
    return null;
  }
  try {
    const buf = Buffer.from(ciphertext, "base64");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    console.error("Failed to decrypt integration secret (wrong key or corrupt data).");
    return null;
  }
}
