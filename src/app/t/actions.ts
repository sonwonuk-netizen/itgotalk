"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/session";
import { asService, asUser } from "@/lib/db/client";
import { generateReports } from "@/lib/server/reports";
import { baseUrl } from "@/lib/server/url";

/**
 * Writes run with asService, so each action first checks through the teacher's read scope
 * (src/lib/db/scope.ts) that the target row is theirs — the job RLS write policies did on Postgres.
 */

/** ST-21: comment on an attempt or report of a student in the teacher's organization. */
export async function addCommentAction(fd: FormData) {
  const user = await requireStaff();
  const body = String(fd.get("body") ?? "").trim();
  const attemptId = String(fd.get("attemptId") ?? "") || null;
  const reportId = String(fd.get("reportId") ?? "") || null;
  const studentId = String(fd.get("studentId") ?? "");
  if (!body || (!attemptId && !reportId)) return;
  const visible = await asUser(user.id, async (tx) => {
    if (attemptId && (await tx.query("select 1 from attempts where id = $1 and student_id <> $2", [attemptId, user.id])).rows.length === 0) return false;
    if (reportId && (await tx.query("select 1 from reports where id = $1", [reportId])).rows.length === 0) return false;
    return true;
  });
  if (!visible) return;
  await asService((tx) =>
    tx.query("insert into comments (author_id, attempt_id, report_id, body) values ($1,$2,$3,$4)", [user.id, attemptId, reportId, body.slice(0, 1000)]),
  );
  revalidatePath(`/t/students/${studentId}`);
}

export async function markAlertReadAction(fd: FormData) {
  const user = await requireStaff();
  const id = String(fd.get("alertId") ?? "");
  const visible = await asUser(user.id, async (tx) => (await tx.query("select 1 from teacher_alerts where id = $1", [id])).rows.length > 0);
  if (!visible) return;
  await asService((tx) => tx.query("update teacher_alerts set read_at = $2 where id = $1 and read_at is null", [id, new Date()]));
  revalidatePath("/t/alerts");
  revalidatePath("/t/students");
}

/** Generates a parent report for one student now (the 14-day job does this for everyone). */
export async function createReportAction(fd: FormData) {
  const user = await requireStaff();
  const studentId = String(fd.get("studentId") ?? "");
  // The teacher must be able to see this student.
  const visible = await asUser(user.id, async (tx) => (await tx.query("select 1 from profiles where id = $1 and role = 'student'", [studentId])).rows.length > 0);
  if (!visible) return;
  await generateReports({ studentIds: [studentId], baseUrl: await baseUrl() });
  revalidatePath(`/t/students/${studentId}`);
}

export async function reissueInviteAction() {
  const user = await requireStaff({ orgAdmin: true });
  if (!user.organizationId) return;
  const code = randomBytes(6).toString("base64url").replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase().padEnd(8, "X");
  await asService((tx) => tx.query("update organizations set invite_code = $1 where id = $2", [code, user.organizationId]));
  revalidatePath("/t/org");
}

/** The director approves (or revokes) teachers of their own organization only. */
export async function setTeacherApprovalAction(fd: FormData) {
  const user = await requireStaff({ orgAdmin: true });
  if (!user.organizationId) return;
  const teacherId = String(fd.get("teacherId") ?? "");
  const approve = fd.get("approve") === "1";
  await asService((tx) =>
    tx.query("update profiles set is_approved = $2 where id = $1 and role = 'teacher' and organization_id = $3", [teacherId, approve, user.organizationId]),
  );
  revalidatePath("/t/org");
}
