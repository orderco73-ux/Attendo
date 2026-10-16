"use server";
import { redirect } from "next/navigation";
import { connectDB } from "@/server/db/connect";
import { authenticate, changeOwnPassword } from "@/server/services/auth";
import { clearSessionCookie, getCurrentActor, requestIp, setSessionCookie } from "@/server/auth/session";
import { audit } from "@/server/services/audit";
import { run, runPublic, type ActionResult } from "./_run";

export async function loginAction(input: { email: string; password: string }): Promise<ActionResult<null>> {
  const res = await runPublic(async () => {
    const user = await authenticate(input, await requestIp());
    await setSessionCookie(user);
    return null;
  });
  return res;
}

export async function logoutAction() {
  await connectDB();
  const actor = await getCurrentActor();
  if (actor) await audit(actor, { action: "auth.logout", summary: "تسجيل خروج", entityType: "user", entityId: actor.id });
  await clearSessionCookie();
  redirect("/login");
}

export async function changePasswordAction(input: unknown) {
  return run(async (actor) => {
    const user = await changeOwnPassword(actor, input);
    await setSessionCookie(user); // keep this session valid after bumping sessionVersion
    return null;
  });
}
