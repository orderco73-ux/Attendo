import mongoose, { Schema, type Model, type Types } from "mongoose";
import { SPECIALIZATION_POLICIES, type SpecializationPolicy } from "@/lib/constants";

/* -------- College -------- */
export interface ICollege {
  _id: Types.ObjectId;
  name: string;
  code: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
const CollegeSchema = new Schema<ICollege>(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 20 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
export const College: Model<ICollege> = (mongoose.models.College as Model<ICollege>) || mongoose.model<ICollege>("College", CollegeSchema);

/* -------- Academic year -------- */
export interface IAcademicYear {
  _id: Types.ObjectId;
  college: Types.ObjectId;
  name: string;
  level: number;
  specializationPolicy: SpecializationPolicy;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
const AcademicYearSchema = new Schema<IAcademicYear>(
  {
    college: { type: Schema.Types.ObjectId, ref: "College", required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    level: { type: Number, required: true, min: 1, max: 12 },
    specializationPolicy: { type: String, enum: SPECIALIZATION_POLICIES, default: "any" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
AcademicYearSchema.index({ college: 1, level: 1 }, { unique: true });
export const AcademicYear: Model<IAcademicYear> =
  (mongoose.models.AcademicYear as Model<IAcademicYear>) || mongoose.model<IAcademicYear>("AcademicYear", AcademicYearSchema);

/* -------- Department / specialization -------- */
export interface IDepartment {
  _id: Types.ObjectId;
  college: Types.ObjectId;
  name: string;
  code: string;
  isGeneral: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
const DepartmentSchema = new Schema<IDepartment>(
  {
    college: { type: Schema.Types.ObjectId, ref: "College", required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    code: { type: String, required: true, uppercase: true, trim: true, maxlength: 20 },
    isGeneral: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
DepartmentSchema.index({ college: 1, code: 1 }, { unique: true });
DepartmentSchema.index({ college: 1, isGeneral: 1 }, { unique: true, partialFilterExpression: { isGeneral: true } });
export const Department: Model<IDepartment> =
  (mongoose.models.Department as Model<IDepartment>) || mongoose.model<IDepartment>("Department", DepartmentSchema);

/* -------- Section / class -------- */
export interface ISection {
  _id: Types.ObjectId;
  college: Types.ObjectId;
  academicYear: Types.ObjectId;
  department?: Types.ObjectId | null;
  name: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
const SectionSchema = new Schema<ISection>(
  {
    college: { type: Schema.Types.ObjectId, ref: "College", required: true },
    academicYear: { type: Schema.Types.ObjectId, ref: "AcademicYear", required: true },
    department: { type: Schema.Types.ObjectId, ref: "Department", default: null },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
SectionSchema.index({ academicYear: 1, department: 1, name: 1 }, { unique: true });
export const Section: Model<ISection> = (mongoose.models.Section as Model<ISection>) || mongoose.model<ISection>("Section", SectionSchema);
