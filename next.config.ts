import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pg", "pdfkit", "bullmq", "ioredis", "bcryptjs"],
  poweredByHeader: false,
};

export default config;
