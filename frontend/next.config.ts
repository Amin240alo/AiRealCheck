import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api-proxy/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5001'}/:path*`,
      },
    ];
  },
  images: {
    domains: [],
  },
};

export default nextConfig;
