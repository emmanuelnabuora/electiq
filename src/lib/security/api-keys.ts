import { randomBytes, createHash } from "crypto";

/**
 * API keys are generated as a random 32-byte value, prefixed for easy
 * visual identification (electiq_live_...), and stored only as a SHA-256
 * hash -- the same "never store the secret, only a verifier" pattern as
 * password hashing, except SHA-256 rather than bcrypt is appropriate
 * here: bcrypt is deliberately slow to resist brute-forcing a short,
 * human-choosable password; this key is already a high-entropy random
 * value no attacker could feasibly guess, so a slow hash buys nothing
 * and would only add latency to every single public API request that
 * presents a key.
 */
export function generateApiKey(): { rawKey: string; keyHash: string; keyPrefix: string } {
  const raw = randomBytes(32).toString("base64url");
  const rawKey = `electiq_live_${raw}`;
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = rawKey.slice(0, 18);
  return { rawKey, keyHash, keyPrefix };
}

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}
