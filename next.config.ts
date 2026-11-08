import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Classic dynamic rendering: every screen here is live deal state, so the
  // Cache Components model (Suspense/"use cache" everywhere) adds friction
  // without benefit for this app.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
};

export default nextConfig;
