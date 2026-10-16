import bcrypt from "bcryptjs";

const COST = 12;

export async function hashPassword(plain: string): Promise<string> {
  if (plain.length < 8) throw new Error("Password too short");
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Used to keep timing similar when the user does not exist (prevents account enumeration by timing).
let dummyHash: Promise<string> | null = null;
export async function burnPasswordCheck(plain: string) {
  dummyHash ??= bcrypt.hash("attendo-dummy-password", COST);
  await bcrypt.compare(plain, await dummyHash);
}
