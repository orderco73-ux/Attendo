import { Types } from "mongoose";
import type { Permission, Role, StaffKind } from "@/lib/constants";
import type { IUser } from "@/server/db/models";

/** Authenticated principal passed to every service. Plain data — safe to build in tests. */
export interface Actor {
  id: string;
  oid: Types.ObjectId;
  name: string;
  email: string;
  role: Role;
  staff: {
    kind: StaffKind;
    title?: string;
    permissions: Permission[];
    scope: { college: string | null; academicYears: string[]; departments: string[]; sections: string[] };
  } | null;
}

export function toActor(u: Pick<IUser, "_id" | "name" | "email" | "role" | "staff">): Actor {
  return {
    id: String(u._id),
    oid: new Types.ObjectId(String(u._id)),
    name: u.name,
    email: u.email,
    role: u.role,
    staff:
      u.role === "staff" && u.staff
        ? {
            kind: u.staff.kind,
            title: u.staff.title,
            permissions: [...(u.staff.permissions ?? [])],
            scope: {
              college: u.staff.scope?.college ? String(u.staff.scope.college) : null,
              academicYears: (u.staff.scope?.academicYears ?? []).map(String),
              departments: (u.staff.scope?.departments ?? []).map(String),
              sections: (u.staff.scope?.sections ?? []).map(String),
            },
          }
        : null,
  };
}
