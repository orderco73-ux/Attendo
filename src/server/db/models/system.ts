import mongoose, { Schema, type Model, type Types } from "mongoose";

/* -------- Audit log -------- */
export interface IAuditLog {
  _id: Types.ObjectId;
  actor?: Types.ObjectId | null;
  actorName?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  summary: string;
  meta?: Record<string, unknown>;
  ip?: string;
  createdAt: Date;
}
const AuditLogSchema = new Schema<IAuditLog>(
  {
    actor: { type: Schema.Types.ObjectId, ref: "User", default: null },
    actorName: String,
    action: { type: String, required: true },
    entityType: String,
    entityId: String,
    summary: { type: String, required: true, maxlength: 500 },
    meta: { type: Schema.Types.Mixed },
    ip: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
AuditLogSchema.index({ actor: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
export const AuditLog: Model<IAuditLog> = (mongoose.models.AuditLog as Model<IAuditLog>) || mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);

/* -------- Rate limit counters -------- */
export interface IRateLimit {
  _id: Types.ObjectId;
  key: string;
  count: number;
  expiresAt: Date;
}
const RateLimitSchema = new Schema<IRateLimit>({
  key: { type: String, required: true, unique: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});
RateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const RateLimit: Model<IRateLimit> =
  (mongoose.models.RateLimit as Model<IRateLimit>) || mongoose.model<IRateLimit>("RateLimit", RateLimitSchema);

/* -------- Settings -------- */
export interface ISetting {
  _id: Types.ObjectId;
  key: string;
  value: unknown;
  updatedBy?: Types.ObjectId | null;
}
const SettingSchema = new Schema<ISetting>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);
export const Setting: Model<ISetting> = (mongoose.models.Setting as Model<ISetting>) || mongoose.model<ISetting>("Setting", SettingSchema);

/* -------- Import jobs -------- */
export interface IImportJob {
  _id: Types.ObjectId;
  createdBy: Types.ObjectId;
  fileName: string;
  status: "ready" | "processing" | "completed" | "cancelled";
  totals: { rows: number; valid: number; invalid: number; duplicate: number; created: number; failed: number };
  lease?: { owner: string; until: Date } | null;
  expiresAt: Date;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
const ImportJobSchema = new Schema<IImportJob>(
  {
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    fileName: { type: String, required: true, maxlength: 200 },
    status: { type: String, enum: ["ready", "processing", "completed", "cancelled"], default: "ready" },
    totals: {
      rows: { type: Number, default: 0 },
      valid: { type: Number, default: 0 },
      invalid: { type: Number, default: 0 },
      duplicate: { type: Number, default: 0 },
      created: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
    lease: { type: new Schema({ owner: String, until: Date }, { _id: false }), default: null },
    expiresAt: { type: Date, required: true },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
ImportJobSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
ImportJobSchema.index({ createdBy: 1, createdAt: -1 });
export const ImportJob: Model<IImportJob> =
  (mongoose.models.ImportJob as Model<IImportJob>) || mongoose.model<IImportJob>("ImportJob", ImportJobSchema);

export interface ImportRowData {
  fullName: string;
  registrationNumber?: string;
  academicYear?: string;
  department?: string;
  section?: string;
  notes?: string;
  // Resolved ids (set during validation)
  collegeId?: string;
  academicYearId?: string;
  departmentId?: string;
  sectionId?: string;
}
export interface IImportRow {
  _id: Types.ObjectId;
  job: Types.ObjectId;
  rowNumber: number;
  data: ImportRowData;
  status: "valid" | "invalid" | "duplicate" | "created" | "failed";
  errors: string[];
  student?: Types.ObjectId | null;
  studentCode?: string | null;
  dedupeKey?: string | null;
  expiresAt: Date;
}
const ImportRowSchema = new Schema<IImportRow>(
  {
    job: { type: Schema.Types.ObjectId, ref: "ImportJob", required: true },
    rowNumber: { type: Number, required: true },
    data: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: ["valid", "invalid", "duplicate", "created", "failed"], required: true },
    errors: [String],
    student: { type: Schema.Types.ObjectId, ref: "Student", default: null },
    studentCode: { type: String, default: null },
    dedupeKey: { type: String, default: null },
    expiresAt: { type: Date, required: true },
  },
  { suppressReservedKeysWarning: true },
);
ImportRowSchema.index({ job: 1, rowNumber: 1 }, { unique: true });
ImportRowSchema.index({ job: 1, status: 1, rowNumber: 1 });
ImportRowSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const ImportRow: Model<IImportRow> =
  (mongoose.models.ImportRow as Model<IImportRow>) || mongoose.model<IImportRow>("ImportRow", ImportRowSchema);
