"use server";
import { revalidatePath } from "next/cache";
import { createStudent, setStudentArchived, updateStudent } from "@/server/services/students";
import { cancelImportJob, processImportBatch } from "@/server/services/imports";
import { run } from "./_run";

export async function createStudentAction(input: unknown) {
  return run(async (a) => {
    const r = await createStudent(a, input);
    revalidatePath("/students");
    return r;
  });
}

export async function updateStudentAction(id: string, input: unknown) {
  return run(async (a) => {
    const r = await updateStudent(a, id, input);
    revalidatePath("/students");
    revalidatePath(`/students/${id}`);
    return r;
  });
}

export async function archiveStudentAction(id: string, archived: boolean) {
  return run(async (a) => {
    await setStudentArchived(a, id, archived);
    revalidatePath("/students");
    revalidatePath(`/students/${id}`);
    return null;
  });
}

export async function processImportBatchAction(jobId: string) {
  return run(async (a) => {
    const r = await processImportBatch(a, jobId);
    if (r.done) revalidatePath("/students");
    return r;
  });
}

export async function cancelImportAction(jobId: string) {
  return run(async (a) => {
    await cancelImportJob(a, jobId);
    revalidatePath(`/students/import/${jobId}`);
    return null;
  });
}
