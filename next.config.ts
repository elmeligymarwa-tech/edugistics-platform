import type { NextConfig } from "next";

// The school-planning SaaS used to live at these bare paths, before moving
// under /app. Kept as permanent redirects so bookmarks and shared links
// still work.
const LEGACY_APP_PATHS = [
  "dashboard",
  "expenses",
  "financing",
  "glossary",
  "reports",
  "revenue",
  "scenarios",
  "settings",
  "setup",
  "staffing",
  "statements",
  "stm",
  "valuation",
];

const nextConfig: NextConfig = {
  // @prisma/client and @node-rs/argon2 ship native binaries — keep Turbopack
  // from trying to bundle them.
  serverExternalPackages: ["@prisma/client", "@node-rs/argon2"],
  async redirects() {
    return LEGACY_APP_PATHS.map((path) => ({
      source: `/${path}`,
      destination: `/app/${path}`,
      permanent: true,
    })).concat([
      {
        source: "/training/privacy",
        destination: "/policies/privacy",
        permanent: true,
      },
    ]);
  },
};

export default nextConfig;
