import { z } from "zod";

/**
 * Typed environment loader.
 *
 * - Validated lazily (first access), not at import time, so `next build`
 *   succeeds without a populated .env.
 * - DRY_RUN defaults to TRUE: with zero credentials the app runs fully
 *   simulated (Rules.md §4). Set DRY_RUN=false only when live creds exist.
 * - Provider creds are optional; adapters degrade to dry-run when missing.
 */

const boolFromString = z
  .string()
  .optional()
  .transform((v) => v !== "false" && v !== "0");

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  /** New-style key name (sb_publishable_…) — interchangeable with anon key. */
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  /** Server-only. Never import into client code (Rules.md §3). */
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  /** Global simulation flag — flips every adapter to dry-run. Default true. */
  DRY_RUN: boolFromString,
  /** Base URL for absolute links (share links, Twilio callbacks). */
  APP_URL: z.string().url().default("http://localhost:3000"),
  /** 32-byte base64 key for AES-256-GCM encryption of per-org secrets. */
  SECRETS_ENCRYPTION_KEY: z.string().min(1).optional(),
  /** Shared secret for cron endpoints (Vercel Cron injects it as Bearer). */
  CRON_SECRET: z.string().min(1).optional(),
  // Env-level provider fallbacks (per-org values in integration_settings win)
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  WHATSAPP_SENDER: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  AI_API_KEY: z.string().optional(),
  AI_BASE_URL: z.string().url().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | null = null;

/** Server-side env access. Do not call from client components. */
export function getEnv(): ServerEnv {
  if (!cachedEnv) {
    const parsed = serverEnvSchema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(
        `Invalid environment configuration: ${parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}`,
      );
    }
    cachedEnv = parsed.data;
  }
  return cachedEnv;
}

/** True when the whole app runs in simulation mode. */
export function isGlobalDryRun(): boolean {
  return getEnv().DRY_RUN;
}

/**
 * Public (browser-safe) Supabase config. Next.js inlines NEXT_PUBLIC_* at
 * build time, so these must be referenced statically.
 */
export function getPublicSupabaseConfig(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}
