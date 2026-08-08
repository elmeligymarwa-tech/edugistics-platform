import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @prisma/client and @node-rs/argon2 ship native binaries — keep Turbopack
  // from trying to bundle them.
  serverExternalPackages: ["@prisma/client", "@node-rs/argon2"],
};

export default nextConfig;
