/** Field rules shared by signup and the 본사 관리자 member edit form. */

export const LOGIN_ID = /^[a-z0-9_]{4,20}$/;
export const PHONE = /^01[016789]-?\d{3,4}-?\d{4}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Optional email: "" when left empty, null when it does not look like an address, else lowercased. */
export function normalizeEmail(raw: string): string | null | "" {
  const v = raw.trim().toLowerCase();
  if (!v) return "";
  return v.length <= 254 && EMAIL.test(v) ? v : null;
}

/** Mobile number as stored (digits only), or null when it does not look like one. */
export function normalizePhone(raw: string): string | null {
  const v = raw.trim();
  return PHONE.test(v) ? v.replaceAll("-", "") : null;
}
