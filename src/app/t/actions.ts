"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/session";
import { asUser } from "@/lib/db/client";
import { generateReports } from "@/lib/server/reports";
import { baseUrl } from "@/lib/server/url";

/** ST-21: comment on an attempt or report. The RLS insert policy checks the student belongs to the teacher's org. */
export async function addCommentAction(fd: FormData) {
  const user = await requireStaff();
  const body = String(fd.get("body") ?? "").trim();
  const attemptId = String(fd.get("attemptId") ?? "") || null;
  const reportId = String(fd.get("reportId") ?? "") || null;
  const studentId = String(fd.get("studentId") ?? "");
  if (!body || (!attemptId && !reportId)) return;
  await asUser(user.id, (tx) =>
    tx.query("insert into comments (author_id, attempt_id, report_id, body) values ($1,$2,$3,$4)", [user.id, attemptId, reportId, body.slice(0, 1000)]),
  );
  revalidatePath(`/t/students/${studentId}`);
}

export async function markAlertReadAction(fd: FormData) {
  const user = await requireStaff();
  const id = String(fd.get("alertId") ?? "");
  await asUser(user.id, (tx) => tx.query("update teacher_alerts set read_at = now() where id = $1 and read_at is null", [id]));
  revalidatePath("/t/alerts");
  revalidatePath("/t/students");
}

/** Generates a parent report for one student now (the 14-day job does this for everyone). */
export async function createReportAction(fd: FormData) {
  const user = await requireStaff();
  const studentId = String(fd.get("studentId") ?? "");
  // Authorize through RLS: the teacher must be able to see this student.
  const visible = await asUser(user.id, async (tx) => (await tx.query("select 1 from profiles where id = $1 and role = 'student'", [studentId])).rows.length > 0);
  if (!visible) return;
  await generateReports({ studentIds: [studentId], baseUrl: await baseUrl() });
  revalidatePath(`/t/students/${studentId}`);
}

export async function reissueInviteAction() {
  const user = await requireStaff({ orgAdmin: true });
  const code = randomBytes(6).toString("base64url").replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase().padEnd(8, "X");
  await asUser(user.id, (tx) => tx.query("update organizations set invite_code = $1 where id = public.admin_org()", [code]));
  revalidatePath("/t/org");
}

export async function setTeacherApprovalAction(fd: FormData) {
  const user = await requireStaff({ orgAdmin: true });
  const teacherId = String(fd.get("teacherId") ?? "");
  const approve = fd.get("approve") === "1";
  await asUser(user.id, (tx) => tx.query("update profiles set is_approved = $2 where id = $1 and role = 'teacher'", [teacherId, approve]));
  revalidatePath("/t/org");
}
