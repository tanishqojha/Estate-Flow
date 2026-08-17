import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Twilio webhook authentication: X-Twilio-Signature is HMAC-SHA1 of the full
 * request URL + alphabetically sorted POST params, keyed by the auth token.
 * https://www.twilio.com/docs/usage/security#validating-requests
 */
export function validateTwilioSignature(params: {
  authToken: string;
  signature: string | null;
  url: string;
  formParams: Record<string, string>;
}): boolean {
  if (!params.signature) return false;

  const sorted = Object.keys(params.formParams).sort();
  let payload = params.url;
  for (const key of sorted) {
    payload += key + (params.formParams[key] ?? "");
  }

  const expected = createHmac("sha1", params.authToken).update(payload, "utf8").digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(params.signature, "base64");
  } catch {
    return false;
  }
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}
