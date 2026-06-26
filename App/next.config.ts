import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      // Stale-while-revalidate for navigation pages
      {
        urlPattern: /^https:\/\/3diner\.vercel\.app\/[^_].*/,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "pages-cache",
          expiration: { maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 },
        },
      },
      // Cache-first for Supabase storage (menu images)
      {
        urlPattern: /^https:\/\/zvkmcbvckuupjsdftsyz\.supabase\.co\/storage\/.*/,
        handler: "CacheFirst",
        options: {
          cacheName: "media-cache",
          expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 },
        },
      },
      // Stale-while-revalidate for Next.js static assets
      {
        urlPattern: /\/_next\/static\/.*/,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "next-static-cache",
          expiration: { maxAgeSeconds: 30 * 24 * 60 * 60 },
        },
      },
    ],
  },
});

const nextConfig: NextConfig = {
  transpilePackages: ["@mkkellogg/gaussian-splats-3d", "three"],

  turbopack: {},

  experimental: {
    serverActions: { bodySizeLimit: "30mb" },
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "zvkmcbvckuupjsdftsyz.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      { protocol: "https", hostname: "*.r2.dev" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },

  async headers() {
    return [
      // Static 3D model files — perlu CORP agar bisa di-fetch oleh Web Workers
      {
        source: "/models/:file*",
        headers: [
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // App pages — COOP untuk isolasi window
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
