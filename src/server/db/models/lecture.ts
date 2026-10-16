import mongoose, { Schema, type Model, type Types } from "mongoose";
import {
  ATTENDANCE_METHODS,
  LECTURE_STATUSES,
  RECORD_SOURCES,
  RECORD_STATUSES,
  SESSION_MODES,
  type AttendanceMethod,
  type LectureStatus,
  type RecordSource,
  type RecordStatus,
  type SessionMode,
} from "@/lib/constants";

export interface ILecture {
  _id: Types.ObjectId;
  subject: Types.ObjectId;
  title: string;
  number?: number | null;
  startsAt: Date;
  endsAt: Date;
  venue?: string;
  status: LectureStatus;
  attendance: {
    mode: SessionMode;
    method: AttendanceMethod;
    opensAt?: Date | null;
    closesAt?: Date | null;
    location?: { lat: number; lng: number } | null;
    radiusM?: number | null;
    checkinToken: string;
  };
  openedAt?: Date | null;
  closedAt?: Date | null;
  cancelledAt?: Date | null;
  cancelReason?: string;
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const LectureSchema = new Schema<ILecture>(
  {
    subject: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    number: { type: Number, min: 1, max: 1000, default: null },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    venue: { type: String, trim: true, maxlength: 150 },
    status: { type: String, enum: LECTURE_STATUSES, default: "scheduled" },
    attendance: {
      mode: { type: String, enum: SESSION_MODES, required: true },
      method: { type: String, enum: ATTENDANCE_METHODS, required: true },
      opensAt: { type: Date, default: null },
      closesAt: { type: Date, default: null },
      location: {
        type: new Schema({ lat: { type: Number, min: -90, max: 90 }, lng: { type: Number, min: -180, max: 180 } }, { _id: false }),
        default: null,
      },
      radiusM: { type: Number, min: 10, max: 5000, default: null },
      checkinToken: { type: String, required: true },
    },
    openedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, trim: true, maxlength: 300 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);
LectureSchema.pre("validate", function () {
  if (this.endsAt <= this.startsAt) this.invalidate("endsAt", "End time must be after start time");
});
LectureSchema.index({ subject: 1, startsAt: 1 });
LectureSchema.index({ startsAt: 1 });
LectureSchema.index({ status: 1, "attendance.mode": 1, "attendance.opensAt": 1 });
LectureSchema.index({ status: 1, "attendance.closesAt": 1 });
LectureSchema.index({ "attendance.checkinToken": 1 }, { unique: true });

export const Lecture: Model<ILecture> = (mongoose.models.Lecture as Model<ILecture>) || mongoose.model<ILecture>("Lecture", LectureSchema);

/* -------- Attendance record -------- */
export interface IRecordHistory {
  at: Date;
  by?: Types.ObjectId | null;
  from?: RecordStatus | null;
  to: RecordStatus;
  source: RecordSource;
  reason?: string;
}

export interface IAttendanceRecord {
  _id: Types.ObjectId;
  lecture: Types.ObjectId;
  subject: Types.ObjectId;
  student: Types.ObjectId;
  status: RecordStatus;
  source: RecordSource;
  markedBy?: Types.ObjectId | null;
  markedAt: Date;
  distanceM?: number | null;
  deviceId?: string | null;
  history: IRecordHistory[];
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceRecordSchema = new Schema<IAttendanceRecord>(
  {
    lecture: { type: Schema.Types.ObjectId, ref: "Lecture", required: true },
    subject: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    status: { type: String, enum: RECORD_STATUSES, required: true },
    source: { type: String, enum: RECORD_SOURCES, required: true },
    markedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    markedAt: { type: Date, required: true },
    distanceM: { type: Number, default: null },
    deviceId: { type: String, default: null },
    history: [
      new Schema<IRecordHistory>(
        {
          at: { type: Date, required: true },
          by: { type: Schema.Types.ObjectId, ref: "User", default: null },
          from: { type: String, enum: [...RECORD_STATUSES, null], default: null },
          to: { type: String, enum: RECORD_STATUSES, required: true },
          source: { type: String, enum: RECORD_SOURCES, required: true },
          reason: { type: String, maxlength: 300 },
        },
        { _id: false },
      ),
    ],
  },
  { timestamps: true },
);
AttendanceRecordSchema.index({ lecture: 1, student: 1 }, { unique: true });
AttendanceRecordSchema.index({ subject: 1, student: 1 });
AttendanceRecordSchema.index({ student: 1 });
AttendanceRecordSchema.index({ lecture: 1, deviceId: 1 });
AttendanceRecordSchema.index({ markedAt: -1 });

export const AttendanceRecord: Model<IAttendanceRecord> =
  (mongoose.models.AttendanceRecord as Model<IAttendanceRecord>) ||
  mongoose.model<IAttendanceRecord>("AttendanceRecord", AttendanceRecordSchema);
