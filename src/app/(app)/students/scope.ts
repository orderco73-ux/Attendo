import type { Actor } from "@/server/auth/actor";
import type { Structure } from "@/server/services/academic";

/** Active academic years the actor may place students in (UI convenience; the server enforces the same rule). */
export function scopedYears(actor: Actor, structure: Structure) {
  const sc = actor.staff?.scope;
  return structure.years.filter((y) => y.active && (!sc || (y.college === sc.college && (!sc.academicYears.length || sc.academicYears.includes(y.id)))));
}
