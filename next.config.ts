import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["d4250099541c-tunnel-efrgh7rg.devinapps.com"],
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "cjvccnzjifbfadgompem.supabase.co" },
    ],
  },
};

export default nextConfig;
