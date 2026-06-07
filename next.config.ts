import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
        pathname: "/gweb-workspace-assets/uploads/**",
      },
    ],
    dangerouslyAllowSVG: true,
  },
};

export default nextConfig;
