import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    esmExternals: true,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push({
        '@google/genai': '@google/genai',
      });
    }
    return config;
  },
};

export default nextConfig;
