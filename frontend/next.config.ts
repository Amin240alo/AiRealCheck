import type { NextConfig } from "next";

const apiBase = process.env.NEXT_PUBLIC_API_URL;
if (!apiBase) {
  throw new Error("NEXT_PUBLIC_API_URL is required");
}

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api-proxy/:path*',
        destination: `${apiBase}/:path*`,
      },
    ];
  },
  images: {
    domains: [],
  },
};

export default nextConfig;
