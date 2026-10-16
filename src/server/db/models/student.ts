import mongoose, { Schema, type Model, type Types } from "mongoose";
import { STUDENT_STATUSES, type StudentStatus } from "@/lib/constants";

export interface IStudent {
  _id: Types.ObjectId;
  code: string;
  seq: number;
  fullName: string;
  nameKey: string;
  registrationNumber?: string | null;
  college: Types.ObjectId;
  academicYear: Types.ObjectId;
  department: Types.ObjectId;
  section?: Types.ObjectId | null;
  status: StudentStatus;
  dedupeKey?: string | null;
  notes?: string;
  createdBy?: Types.ObjectId | null;
  archivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const StudentSchema = new Schema<IStudent>(
  {
    code: { type: String, required: true, unique: true, immutable: true },
    seq: { type: Number, required: true, immutable: true },
    fullName: { type: String, required: true, trim: true, maxlength: 150 },
    nameKey: { type: String, required: true, index: true },
    registrationNumber: { type: String, trim: true, maxlength: 40, default: null },
    college: { type: Schema.Types.ObjectId, ref: "College", required: true },
    academicYear: { type: Schema.Types.ObjectId, ref: "AcademicYear", required: true },
    department: { type: Schema.Types.ObjectId, ref: "Department", required: true },
    section: { type: Schema.Types.ObjectId, ref: "Section", default: null },
    status: { type: String, enum: STUDENT_STATUSES, default: "active" },
    // Unique only when present (partial index) — see docs/DATABASE.md "Duplicate matching strategy".
    dedupeKey: { type: String, default: undefined },
    notes: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

StudentSchema.index({ dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: "string" } } });
StudentSchema.index({ college: 1, academicYear: 1, department: 1, status: 1, seq: 1 });
StudentSchema.index({ section: 1 });
StudentSchema.index({ seq: -1 });

export const Student: Model<IStudent> = (mongoose.models.Student as Model<IStudent>) || mongoose.model<IStudent>("Student", StudentSchema);

/* -------- Counter (atomic sequences) -------- */
export interface ICounter {
  _id: string;
  seq: number;
}
const CounterSchema = new Schema<ICounter>({ _id: { type: String, required: true }, seq: { type: Number, default: 0 } }, { versionKey: false });
export const Counter: Model<ICounter> = (mongoose.models.Counter as Model<ICounter>) || mongoose.model<ICounter>("Counter", CounterSchema);
