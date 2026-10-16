import mongoose, { Schema, type Model, type Types } from "mongoose";
import { ENROLLMENT_STATUSES, type EnrollmentStatus } from "@/lib/constants";

export interface ISubject {
  _id: Types.ObjectId;
  name: string;
  code: string;
  description?: string;
  college: Types.ObjectId;
  eligibility: {
    academicYears: Types.ObjectId[];
    departments: Types.ObjectId[];
    sections: Types.ObjectId[];
  };
  doctors: Types.ObjectId[];
  assistants: Types.ObjectId[];
  requiresEnrollmentApproval: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SubjectSchema = new Schema<ISubject>(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 30 },
    description: { type: String, trim: true, maxlength: 1000 },
    college: { type: Schema.Types.ObjectId, ref: "College", required: true },
    eligibility: {
      academicYears: [{ type: Schema.Types.ObjectId, ref: "AcademicYear" }],
      departments: [{ type: Schema.Types.ObjectId, ref: "Department" }],
      sections: [{ type: Schema.Types.ObjectId, ref: "Section" }],
    },
    doctors: [{ type: Schema.Types.ObjectId, ref: "User" }],
    assistants: [{ type: Schema.Types.ObjectId, ref: "User" }],
    requiresEnrollmentApproval: { type: Boolean, default: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
SubjectSchema.index({ doctors: 1 });
SubjectSchema.index({ assistants: 1 });
SubjectSchema.index({ college: 1, "eligibility.academicYears": 1 });

export const Subject: Model<ISubject> = (mongoose.models.Subject as Model<ISubject>) || mongoose.model<ISubject>("Subject", SubjectSchema);

/* -------- Enrollment -------- */
export interface IEnrollment {
  _id: Types.ObjectId;
  subject: Types.ObjectId;
  student: Types.ObjectId;
  status: EnrollmentStatus;
  effectiveFrom: Date;
  requestedBy?: Types.ObjectId | null;
  decidedBy?: Types.ObjectId | null;
  decidedAt?: Date | null;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const EnrollmentSchema = new Schema<IEnrollment>(
  {
    subject: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    status: { type: String, enum: ENROLLMENT_STATUSES, required: true },
    effectiveFrom: { type: Date, required: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    decidedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    decidedAt: { type: Date, default: null },
    note: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true },
);
EnrollmentSchema.index({ subject: 1, student: 1 }, { unique: true });
EnrollmentSchema.index({ subject: 1, status: 1 });
EnrollmentSchema.index({ student: 1, status: 1 });
EnrollmentSchema.index({ status: 1, createdAt: -1 });

export const Enrollment: Model<IEnrollment> =
  (mongoose.models.Enrollment as Model<IEnrollment>) || mongoose.model<IEnrollment>("Enrollment", EnrollmentSchema, "subjectenrollments");
