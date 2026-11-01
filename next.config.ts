import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  devIndicators: false,
  eslint: { ignoreDuringBuilds: true },
  serverExternalPackages: ["bcryptjs", "exceljs", "@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner"],
};

export default nextConfig;
