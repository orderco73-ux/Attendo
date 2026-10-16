/**
 * Secure bootstrap of an administrator account (no public endpoint exists for this).
 *
 *   npm run create-admin
 *   # or non-interactive (CI / first deploy):
 *   ADMIN_EMAIL=a@b.c ADMIN_NAME="..." ADMIN_PASSWORD="..." npm run create-admin
 *
 * Requires MONGODB_URI (read from .env.local / .env or the environment).
 * If the email already exists as an admin, its password is reset (and its sessions revoked).
 */
import "dotenv/config";
import { config } from "dotenv";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import mongoose from "mongoose";

config({ path: ".env.local", override: false });

async function main() {
  const { connectDB } = await import("../src/server/db/connect");
  const { User } = await import("../src/server/db/models");
  const { hashPassword } = await import("../src/server/auth/password");

  const rl = createInterface({ input: stdin, output: stdout });
  const ask = async (q: string, envKey: string) => process.env[envKey] || (await rl.question(q)).trim();
  const email = (await ask("Admin email: ", "ADMIN_EMAIL")).toLowerCase();
  const name = await ask("Admin full name: ", "ADMIN_NAME");
  const password = await ask("Password (min 12 chars): ", "ADMIN_PASSWORD");
  rl.close();

  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Invalid email");
  if (name.length < 3) throw new Error("Name too short");
  // --allow-weak: explicit opt-in down to the app-wide minimum (8); change it later from the account page.
  const min = process.argv.includes("--allow-weak") ? 8 : 12;
  if (password.length < min) throw new Error(`Use at least ${min} characters for administrator passwords`);

  await connectDB();
  const existing = await User.findOne({ email });
  if (existing && existing.role !== "admin") throw new Error(`${email} exists with role "${existing.role}". Refusing to change its role.`);
  const passwordHash = await hashPassword(password);
  if (existing) {
    existing.passwordHash = passwordHash;
    existing.name = name;
    existing.active = true;
    existing.sessionVersion += 1;
    await existing.save();
    console.log(`✔ Admin ${email} updated (password reset, sessions revoked).`);
  } else {
    await User.create({ email, name, role: "admin", passwordHash, active: true });
    console.log(`✔ Admin ${email} created.`);
  }
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error("✖", e instanceof Error ? e.message : e);
  await mongoose.disconnect().catch(() => null);
  process.exit(1);
});
