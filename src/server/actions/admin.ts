"use server";
import { revalidatePath } from "next/cache";
import { saveCollege, saveDepartment, saveSection, saveYear } from "@/server/services/academic";
import { saveAccount, saveStaff, setUserActive } from "@/server/services/users";
import { saveSubject, setSubjectAssistants } from "@/server/services/subjects";
import { updateSettings } from "@/server/services/settings";
import { run } from "./_run";

export async function saveCollegeAction(input: unknown, id?: string) {
  return run(async (a) => {
    const r = await saveCollege(a, input, id);
    revalidatePath("/admin/structure");
    return r;
  });
}
export async function saveYearAction(input: unknown, id?: string) {
  return run(async (a) => {
    const r = await saveYear(a, input, id);
    revalidatePath("/admin/structure");
    return r;
  });
}
export async function saveDepartmentAction(input: unknown, id?: string) {
  return run(async (a) => {
    const r = await saveDepartment(a, input, id);
    revalidatePath("/admin/structure");
    return r;
  });
}
export async function saveSectionAction(input: unknown, id?: string) {
  return run(async (a) => {
    const r = await saveSection(a, input, id);
    revalidatePath("/admin/structure");
    return r;
  });
}

export async function saveDoctorAction(input: unknown, id?: string) {
  return run(async (a) => {
    const r = await saveAccount(a, "doctor", input, id);
    revalidatePath("/admin/doctors");
    return r;
  });
}
export async function saveAdminAction(input: unknown, id?: string) {
  return run(async (a) => {
    const r = await saveAccount(a, "admin", input, id);
    revalidatePath("/admin/doctors");
    return r;
  });
}
export async function saveStaffAction(input: unknown, id?: string) {
  return run(async (a) => {
    const r = await saveStaff(a, input, id);
    revalidatePath("/admin/staff");
    return r;
  });
}
export async function setUserActiveAction(id: string, active: boolean) {
  return run(async (a) => {
    await setUserActive(a, id, active);
    revalidatePath("/admin/staff");
    revalidatePath("/admin/doctors");
    return null;
  });
}

export async function saveSubjectAction(input: unknown, id?: string) {
  return run(async (a) => {
    const r = await saveSubject(a, input, id);
    revalidatePath("/subjects");
    return r;
  });
}
export async function setAssistantsAction(subjectId: string, userIds: string[]) {
  return run(async (a) => {
    await setSubjectAssistants(a, subjectId, userIds);
    revalidatePath(`/subjects/${subjectId}/settings`);
    return null;
  });
}

export async function updateSettingsAction(input: unknown) {
  return run(async (a) => {
    await updateSettings(a, input);
    revalidatePath("/", "layout");
    return null;
  });
}
