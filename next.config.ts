import type { NextConfig } from "next";
import { DEPLOYMENT_URL } from "vercel-url";

const nextConfig: NextConfig = {
  assetPrefix: DEPLOYMENT_URL,
  turbopack: {
    resolveAlias: {
      "zod/v3": "zod",
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "zod/v3": "zod",
    };
    return config;
  },
};

export default nextConfig;
