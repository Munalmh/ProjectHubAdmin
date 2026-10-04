import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: ["http://127.0.0.1:3000", "http://localhost:3000"],
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  
  // ADD THIS BLOCK TO FIX THE MISSING PRISMA MODULE ERROR:
  outputFileTracingIncludes: {
    "/*": ["./node_modules/.prisma/client/**/*", "./node_modules/@prisma/client/**/*"],
  },
};

export default nextConfig;