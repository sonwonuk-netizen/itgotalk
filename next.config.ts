import type { NextConfig } from "next";

// `pnpm cf:deploy` / `pnpm cf:build` set this: on Cloudflare the app uses the D1 binding only, and
// node:sqlite (local database) does not exist in Workers.
const cloudflare = process.env.ITGO_TARGET === "cloudflare";

const nextConfig: NextConfig = {
  turbopack: cloudflare ? { resolveAlias: { "node:sqlite": "./src/lib/db/node-sqlite-unavailable.ts" } } : {},
  // Keep the hand-written CLAUDE.md untouched by `next dev`.
  agentRules: false,
};

export default nextConfig;
