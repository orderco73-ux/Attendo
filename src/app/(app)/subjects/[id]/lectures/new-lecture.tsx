"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/overlay";
import { LectureForm } from "@/components/shared/lecture-form";

export function NewLectureButton({ subjectId, defaultRadius, today }: { subjectId: string; defaultRadius: number; today: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus /> محاضرة جديدة</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>محاضرة جديدة</DialogTitle>
        </DialogHeader>
        <LectureForm
          subjectId={subjectId}
          defaultRadius={defaultRadius}
          onDone={() => setOpen(false)}
          initial={{
            title: "",
            number: "",
            date: today,
            startTime: "09:00",
            endTime: "10:30",
            venue: "",
            mode: "manual",
            method: "location",
            opensDate: today,
            opensTime: "09:00",
            closesDate: today,
            closesTime: "09:20",
            lat: "",
            lng: "",
            radiusM: String(defaultRadius),
            repeatWeeks: "1",
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
