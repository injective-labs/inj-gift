import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' https://injpass.com https://www.injpass.com https://*.injpass.com http://localhost:3000",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
