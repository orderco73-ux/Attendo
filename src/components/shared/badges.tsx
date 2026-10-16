import { Badge, type BadgeVariant } from "@/components/ui/display";
import {
  ENROLLMENT_STATUS_LABELS,
  LECTURE_STATUS_LABELS,
  RECORD_SOURCE_LABELS,
  RECORD_STATUS_LABELS,
  type EnrollmentStatus,
  type LectureStatus,
  type RecordSource,
  type RecordStatus,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

const dot = (cls: string) => <span className={cn("size-1.5 rounded-full", cls)} />;

export function LectureStatusBadge({ status }: { status: LectureStatus }) {
  const map: Record<LectureStatus, [BadgeVariant, string]> = {
    scheduled: ["muted", "bg-slate-400"],
    open: ["success", "bg-success animate-pulse"],
    closed: ["default", "bg-primary"],
    cancelled: ["danger", "bg-destructive"],
  };
  const [v, d] = map[status];
  return (
    <Badge variant={v}>
      {dot(d)}
      {LECTURE_STATUS_LABELS[status]}
    </Badge>
  );
}

export function RecordStatusBadge({ status }: { status: RecordStatus | null; closed?: boolean }) {
  if (!status) return <Badge variant="muted">لم يسجل</Badge>;
  const v: Record<RecordStatus, BadgeVariant> = { present: "success", absent: "danger", excused: "warning" };
  return <Badge variant={v[status]}>{RECORD_STATUS_LABELS[status]}</Badge>;
}

export function SourceBadge({ source }: { source: RecordSource }) {
  const v: Record<RecordSource, BadgeVariant> = { self_checkin: "default", staff: "muted", doctor_correction: "warning" };
  return <Badge variant={v[source]}>{RECORD_SOURCE_LABELS[source]}</Badge>;
}

export function EnrollmentBadge({ status }: { status: EnrollmentStatus }) {
  const v: Record<EnrollmentStatus, BadgeVariant> = { approved: "success", pending: "warning", rejected: "danger", removed: "muted" };
  return <Badge variant={v[status]}>{ENROLLMENT_STATUS_LABELS[status]}</Badge>;
}

export function ActiveBadge({ active, on = "نشط", off = "معطل" }: { active: boolean; on?: string; off?: string }) {
  return <Badge variant={active ? "success" : "muted"}>{active ? on : off}</Badge>;
}

export function PercentBadge({ value, threshold = 75 }: { value: number | null; threshold?: number }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const v: BadgeVariant = value >= threshold ? "success" : value >= threshold - 15 ? "warning" : "danger";
  return (
    <Badge variant={v} className="tabular-nums">
      {value}%
    </Badge>
  );
}
