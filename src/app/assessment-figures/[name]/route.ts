import { readFile } from "node:fs/promises";
import path from "node:path";

const DIR = path.join(process.cwd(), "content/assessment/figures");
const TYPES: Record<string, string> = { ".svg": "image/svg+xml", ".png": "image/png" };

/**
 * Serves 진단 평가 figures from content/assessment/figures (single source of truth).
 * On Cloudflare there is no filesystem: `pnpm cf:build` copies them to public/assessment-figures,
 * where the Workers static assets answer before this route runs.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!/^[a-z0-9-]+\.(svg|png)$/.test(name)) return new Response("not found", { status: 404 });
  try {
    const body = await readFile(path.join(DIR, name));
    return new Response(body, { headers: { "content-type": TYPES[path.extname(name)]!, "cache-control": "public, max-age=3600" } });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
