import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships WASM + data files that must be loaded from node_modules at runtime.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Keep the hand-written CLAUDE.md untouched by `next dev`.
  agentRules: false,
};

export default nextConfig;
