import mongoose, { Schema, type Model, type Types } from "mongoose";
import { PERMISSIONS, ROLES, STAFF_KINDS, type Permission, type Role, type StaffKind } from "@/lib/constants";

export interface StaffScope {
  college?: Types.ObjectId | null;
  academicYears: Types.ObjectId[];
  departments: Types.ObjectId[];
  sections: Types.ObjectId[];
}

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  passwordHash: string;
  role: Role;
  active: boolean;
  sessionVersion: number;
  staff?: {
    kind: StaffKind;
    title?: string;
    permissions: Permission[];
    scope: StaffScope;
  } | null;
  failedLogins: number;
  lockedUntil?: Date | null;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ScopeSchema = new Schema<StaffScope>(
  {
    college: { type: Schema.Types.ObjectId, ref: "College", default: null },
    academicYears: [{ type: Schema.Types.ObjectId, ref: "AcademicYear" }],
    departments: [{ type: Schema.Types.ObjectId, ref: "Department" }],
    sections: [{ type: Schema.Types.ObjectId, ref: "Section" }],
  },
  { _id: false },
);

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 200 },
    phone: { type: String, trim: true, maxlength: 30 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, index: true },
    active: { type: Boolean, default: true },
    sessionVersion: { type: Number, default: 1 },
    staff: {
      type: new Schema(
        {
          kind: { type: String, enum: STAFF_KINDS, required: true },
          title: { type: String, trim: true, maxlength: 80 },
          permissions: [{ type: String, enum: PERMISSIONS }],
          scope: { type: ScopeSchema, default: () => ({}) },
        },
        { _id: false },
      ),
      default: null,
    },
    failedLogins: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const User: Model<IUser> = (mongoose.models.User as Model<IUser>) || mongoose.model<IUser>("User", UserSchema);
