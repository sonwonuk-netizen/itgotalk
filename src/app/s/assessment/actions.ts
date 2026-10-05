"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { AssessmentError, saveAnswers, startAssessment, submitAssessment } from "@/lib/server/assessment";

type Result = { ok: true } | { ok: false; error: string };

async function wrap(fn: () => Promise<unknown>): Promise<Result> {
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    if (e instanceof AssessmentError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function startAssessmentAction() {
  const user = await requireRole("student");
  const id = await startAssessment(user.id);
  redirect(`/s/assessment/${id}`);
}

export async function saveAnswersAction(attemptId: string, itemId: string, given: Record<string, string>, seconds: number): Promise<Result> {
  const user = await requireRole("student");
  return wrap(() => saveAnswers(user.id, attemptId, itemId, given, seconds));
}

export async function submitAssessmentAction(attemptId: string): Promise<Result> {
  const user = await requireRole("student");
  const r = await wrap(() => submitAssessment(user.id, attemptId));
  if (r.ok) redirect(`/s/assessment/${attemptId}/result`);
  return r;
}
