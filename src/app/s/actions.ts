"use server";

import { requireRole } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { finishPlay, PlayError, startPlay, startTrack, type FinishInput, type FinishResult, type PlayStart } from "@/lib/server/learning";
import type { AttemptMode } from "@/lib/engine";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const MODES: AttemptMode[] = ["practice", "test", "diagnostic", "race_ai"];

async function wrap<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof PlayError) return { ok: false, error: e.message };
    throw e;
  }
}

/** Records the server start time; the client starts its own clock when items arrive. */
export async function startPlayAction(setId: string, mode: AttemptMode): Promise<Result<PlayStart>> {
  const user = await requireRole("student");
  if (!MODES.includes(mode)) return { ok: false, error: "잘못된 모드예요." };
  return wrap(() => startPlay(user, setId, mode));
}

/** Starts a track that has no diagnostic (e.g. 1~9 빨리 누르기). */
export async function startTrackAction(fd: FormData) {
  const user = await requireRole("student");
  const trackId = String(fd.get("trackId") ?? "");
  await startTrack(user, trackId);
  // Same path: a hash-only redirect would keep the stale page, so revalidate explicitly.
  revalidatePath("/s/home");
  redirect(`/s/home?started=${encodeURIComponent(trackId)}#${encodeURIComponent(trackId)}`);
}

export async function finishPlayAction(input: FinishInput): Promise<Result<FinishResult>> {
  const user = await requireRole("student");
  return wrap(() => finishPlay(user, input));
}
