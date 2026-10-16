import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { MongoMemoryServer } from "mongodb-memory-server";

// Keep mongod data next to the project (the OS temp drive may be small).
const base = path.resolve(".tmp");
let dbPath = "";

let server: MongoMemoryServer | undefined;

export async function setup() {
  mkdirSync(base, { recursive: true });
  dbPath = mkdtempSync(path.join(base, "test-db-"));
  server = await MongoMemoryServer.create({ instance: { dbPath } });
  process.env.MONGODB_URI = server.getUri("attendo-test");
  process.env.AUTH_SECRET = "test-auth-secret-0123456789-abcdefghijklmnop";
  process.env.QR_SECRET = "test-qr-secret-0123456789-abcdefghijklmnopqrs";
  process.env.APP_TIMEZONE = "Africa/Cairo";
}

export async function teardown() {
  await server?.stop();
  if (dbPath) rmSync(dbPath, { recursive: true, force: true });
}
