import mongoose from "mongoose";

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };

const g = globalThis as unknown as { __attendoMongo?: Cache };
const cache: Cache = g.__attendoMongo ?? (g.__attendoMongo = { conn: null, promise: null });

/**
 * Returns a connected mongoose instance. The promise is cached on globalThis so warm serverless
 * invocations (and dev hot reloads) reuse the same pool; a failed attempt clears the cache so the next
 * invocation retries instead of reusing a rejected promise.
 */
export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn && mongoose.connection.readyState === 1) return cache.conn;
  if (!cache.promise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is not configured");
    mongoose.set("strictQuery", true);
    cache.promise = mongoose.connect(uri, {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10_000,
      autoIndex: process.env.NODE_ENV !== "production",
    });
  }
  try {
    cache.conn = await cache.promise;
  } catch (err) {
    cache.promise = null;
    throw err;
  }
  return cache.conn;
}

export async function disconnectDB() {
  await mongoose.disconnect();
  cache.conn = null;
  cache.promise = null;
}
