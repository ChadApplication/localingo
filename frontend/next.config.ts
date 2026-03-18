import type { NextConfig } from "next";
import { execSync } from "child_process";

const backendPort = process.env.NEXT_PUBLIC_BACKEND_PORT || "8050";

let gitVersion = "dev";
try {
  gitVersion = execSync("git describe --tags --always 2>/dev/null || echo dev").toString().trim();
} catch { /* ignore */ }

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_VERSION: gitVersion,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    proxyTimeout: 300_000,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `http://localhost:${backendPort}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
