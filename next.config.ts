import type { NextConfig } from "next";
import { APP_BASE_URL } from "@/lib/config";

const nextConfig: NextConfig = {
  assetPrefix: APP_BASE_URL,
};

export default nextConfig;
