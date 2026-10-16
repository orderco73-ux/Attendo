import { Types } from "mongoose";
import { AppError } from "./errors";

export function isObjectId(v: unknown): v is string {
  return typeof v === "string" && /^[a-f0-9]{24}$/i.test(v);
}

/** Parses an id from untrusted input; invalid ids behave like a missing document. */
export function oid(v: unknown): Types.ObjectId {
  if (v instanceof Types.ObjectId) return v;
  if (!isObjectId(v)) throw new AppError("NOT_FOUND");
  return new Types.ObjectId(v);
}

export function optionalOid(v: unknown): Types.ObjectId | null {
  if (v == null || v === "") return null;
  return oid(v);
}

export function oids(v: unknown): Types.ObjectId[] {
  if (!Array.isArray(v)) return [];
  return v.filter(isObjectId).map((x) => new Types.ObjectId(x));
}
