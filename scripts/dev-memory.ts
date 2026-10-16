/**
 * Local development without MongoDB Atlas: starts an in-memory MongoDB (data is lost on exit),
 * seeds the initial structure + demo data + an admin, then runs `next dev` (or `next start` with --prod).
 *
 *   npm run dev:memory
 *
 * Demo admin: admin@demo.local / Admin@123456 (local only).
 */
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { MongoMemoryServer } from "mongodb-memory-server";

/** Non-blocking child process: a blocking execSync would stop this process draining mongod's output pipe. */
function run(cmd: string, env: NodeJS.ProcessEnv) {
  return new Promise<void>((resolve, reject) => {
    const c = spawn(cmd, { stdio: "inherit", env, shell: true });
    c.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited with ${code}`))));
  });
}

async function main() {
  mkdirSync(".tmp", { recursive: true });
  const dbPath = mkdtempSync(path.join(path.resolve(".tmp"), "dev-db-"));
  const mongod = await MongoMemoryServer.create({ instance: { port: Number(process.env.MEMORY_DB_PORT) || 27027, dbPath } });
  const uri = mongod.getUri("attendo");
  const env = {
    ...process.env,
    MONGODB_URI: uri,
    AUTH_SECRET: process.env.AUTH_SECRET || "local-dev-auth-secret-change-me-0123456789",
    QR_SECRET: process.env.QR_SECRET || "local-dev-qr-secret-change-me-0123456789ab",
    CRON_SECRET: process.env.CRON_SECRET || "local-dev-cron-secret",
    APP_TIMEZONE: process.env.APP_TIMEZONE || "Africa/Cairo",
  };
  console.log(`▶ In-memory MongoDB at ${uri}`);
  await run("npx tsx scripts/seed.ts --demo", env);
  await run("npx tsx scripts/create-admin.ts", { ...env, ADMIN_EMAIL: "admin@demo.local", ADMIN_NAME: "مدير النظام", ADMIN_PASSWORD: "Admin@123456" });
  const prod = process.argv.includes("--prod");
  const port = process.env.PORT || "3000";
  const child = spawn("npx", ["next", prod ? "start" : "dev", "-p", port], { stdio: "inherit", env, shell: true });
  const stop = async () => {
    child.kill();
    await mongod.stop();
    rmSync(dbPath, { recursive: true, force: true });
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  child.on("exit", async (code) => {
    await mongod.stop();
    rmSync(dbPath, { recursive: true, force: true });
    process.exit(code ?? 0);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
