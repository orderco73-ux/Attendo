/** Creates/updates MongoDB indexes for every model (run after deploys that change indexes). */
import "dotenv/config";
import { config } from "dotenv";
import mongoose from "mongoose";

config({ path: ".env.local", override: false });

async function main() {
  const { connectDB } = await import("../src/server/db/connect");
  const models = await import("../src/server/db/models");
  await connectDB();
  for (const [name, m] of Object.entries(models)) {
    if (typeof m === "function" && "syncIndexes" in m) {
      const dropped = await (m as mongoose.Model<unknown>).syncIndexes();
      console.log(`✔ ${name}${dropped.length ? ` (dropped: ${dropped.join(", ")})` : ""}`);
    }
  }
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error("✖", e instanceof Error ? e.message : e);
  await mongoose.disconnect().catch(() => null);
  process.exit(1);
});
