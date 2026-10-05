import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { asService } from "@/lib/db/client";

const COOKIE = "itgo_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 14;

export type Role = "student" | "teacher" | "org_admin" | "admin";

export interface SessionUser {
  id: string;
  role: Role;
  initial: string;
  fullName: string | null;
  organizationId: string | null;
  approved: boolean;
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET is required in production");
  return "itgotalk-dev-only-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export async function startSession(userId: string): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC;
  const payload = `${userId}.${exp}`;
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

async function sessionUserId(): Promise<string | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [id, exp, sig] = raw.split(".");
  if (!id || !exp || !sig) return null;
  const expected = Buffer.from(sign(`${id}.${exp}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  return id;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const id = await sessionUserId();
  if (!id) return null;
  const { rows } = await asService((tx) =>
    tx.query<{ id: string; role: Role; display_initial: string; full_name: string | null; organization_id: string | null; is_approved: boolean }>(
      "select id, role, display_initial, full_name, organization_id, is_approved from profiles where id = $1",
      [id],
    ),
  );
  const p = rows[0];
  if (!p) return null;
  return {
    id: p.id,
    role: p.role,
    initial: p.display_initial,
    fullName: p.full_name,
    organizationId: p.organization_id,
    approved: p.is_approved,
  };
}

export function homeFor(role: Role): string {
  if (role === "student") return "/s/home";
  if (role === "admin") return "/admin/regions";
  return "/t/students";
}

/** Redirects to /login when signed out, or to the user's home when the role is not allowed. */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!roles.includes(user.role)) redirect(homeFor(user.role));
  return user;
}

/** Teachers/org admins must be approved before seeing any student data (ST-02). */
export async function requireStaff(opts: { orgAdmin?: boolean } = {}): Promise<SessionUser> {
  const user = await requireRole(...((opts.orgAdmin ? ["org_admin"] : ["teacher", "org_admin"]) as Role[]));
  if (!user.approved) redirect("/pending");
  return user;
}
