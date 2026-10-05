import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Tone = "primary" | "secondary" | "success" | "warn" | "ghost" | "danger";

const tones: Record<Tone, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 disabled:bg-gray-300",
  secondary: "bg-white text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50 disabled:text-gray-400",
  success: "bg-emerald-500 text-white hover:bg-emerald-600 disabled:bg-gray-300",
  warn: "bg-sun-400 text-gray-900 hover:bg-sun-500 disabled:bg-gray-300",
  ghost: "text-gray-600 hover:bg-gray-100",
  danger: "bg-white text-red-600 ring-1 ring-red-200 hover:bg-red-50",
};

export function buttonClass(tone: Tone = "primary", size: "md" | "lg" | "sm" = "md") {
  const sizes = { sm: "min-h-9 px-3 text-sm rounded-lg", md: "min-h-12 px-5 text-base rounded-xl", lg: "min-h-16 px-8 text-2xl rounded-2xl" };
  return `inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition disabled:cursor-not-allowed ${sizes[size]} ${tones[tone]}`;
}

export function Button({ tone, size, className = "", ...rest }: ComponentProps<"button"> & { tone?: Tone; size?: "md" | "lg" | "sm" }) {
  return <button className={`${buttonClass(tone, size)} ${className}`} {...rest} />;
}

export function LinkButton({ tone, size, className = "", ...rest }: ComponentProps<typeof Link> & { tone?: Tone; size?: "md" | "lg" | "sm" }) {
  return <Link className={`${buttonClass(tone, size)} ${className}`} {...rest} />;
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 ${className}`}>{children}</div>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {children}
      {hint && <span className="block text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full min-h-12 rounded-xl border border-gray-300 bg-white px-4 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export function ErrorText({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{children}</p>;
}

export function Badge({ tone = "gray", children }: { tone?: "gray" | "green" | "blue" | "red" | "amber"; children: ReactNode }) {
  const map = {
    gray: "bg-gray-100 text-gray-700",
    green: "bg-emerald-100 text-emerald-800",
    blue: "bg-brand-100 text-brand-700",
    red: "bg-red-100 text-red-700",
    amber: "bg-sun-100 text-amber-800",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[tone]}`}>{children}</span>;
}

/** Initial avatar shown on student screens instead of a real name (rule 5). */
export function Avatar({ initial, size = "md" }: { initial: string; size?: "md" | "lg" }) {
  const s = size === "lg" ? "h-16 w-16 text-2xl" : "h-11 w-11 text-lg";
  return (
    <span aria-label={`이니셜 ${initial}`} className={`inline-flex shrink-0 items-center justify-center rounded-full bg-sun-400 font-bold text-gray-900 ${s}`}>
      {initial}
    </span>
  );
}

export function formatSec(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "-";
  return `${(Math.round(ms / 100) / 10).toFixed(1)}초`;
}

const dtf = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
export function formatDateTime(d: Date | string): string {
  return dtf.format(new Date(d));
}

export const MODE_LABEL: Record<string, string> = {
  practice: "연습",
  test: "테스트",
  diagnostic: "진단",
  race_ai: "AI 시합",
};
