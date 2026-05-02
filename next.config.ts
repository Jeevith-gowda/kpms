import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["bcryptjs", "nodemailer", "node-cron"],
};

export default nextConfig;
