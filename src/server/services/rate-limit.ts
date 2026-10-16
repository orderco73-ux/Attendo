import { RateLimit } from "@/server/db/models";
import { isDuplicateKeyError } from "@/server/errors";

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  remaining: number;
  resetAt: Date;
}

/**
 * Fixed-window counter stored in MongoDB (works across serverless instances).
 * The key embeds the window index so each window is a distinct document; a TTL index removes old ones.
 */
export async function hit(key: string, limit: number, windowSec: number, now = new Date()): Promise<RateLimitResult> {
  const windowIdx = Math.floor(now.getTime() / (windowSec * 1000));
  const resetAt = new Date((windowIdx + 1) * windowSec * 1000);
  const docKey = `${key}:${windowIdx}`;
  let doc;
  try {
    doc = await RateLimit.findOneAndUpdate(
      { key: docKey },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: resetAt } },
      { upsert: true, returnDocument: "after" },
    ).lean();
  } catch (err) {
    // Two concurrent upserts on a fresh key: retry once as a plain update.
    if (!isDuplicateKeyError(err)) throw err;
    doc = await RateLimit.findOneAndUpdate({ key: docKey }, { $inc: { count: 1 } }, { returnDocument: "after" }).lean();
  }
  const count = doc?.count ?? 1;
  return { allowed: count <= limit, count, remaining: Math.max(0, limit - count), resetAt };
}

/** Read the current count without incrementing. */
export async function peek(key: string, windowSec: number, now = new Date()): Promise<number> {
  const windowIdx = Math.floor(now.getTime() / (windowSec * 1000));
  const doc = await RateLimit.findOne({ key: `${key}:${windowIdx}` }).lean();
  return doc?.count ?? 0;
}
