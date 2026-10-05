// Stand-in for node:sqlite in the Cloudflare build (see next.config.ts): Workers use the D1 binding.
export class DatabaseSync {
  constructor() {
    throw new Error("The local SQLite database is not available on Cloudflare. Check the D1 binding \"DB\" in wrangler.jsonc.");
  }
}
