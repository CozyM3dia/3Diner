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
      // Stale-while-revalidate for public navigation pages only.
      // Dashboard routes are excluded: they require auth, serve real-time data,
      // and caching their HTML across deployments causes JS chunk mismatches
      // ("This page couldn't load") because new deployments produce new chunk hashes.
      {
        urlPattern: /^https:\/\/3diner\.vercel\.app\/(?!dashboard|login|api)[^_].*/,
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
    formats: ["image/avif", "image/webp"],
    // URL gambar menu menyertakan timestamp per upload, jadi tiap file unik —
    // hasil optimasi bisa di-cache setahun tanpa risiko basi.
    minimumCacheTTL: 31536000,
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
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://app.midtrans.com https://app.sandbox.midtrans.com",
      "frame-src 'self' https://app.midtrans.com https://app.sandbox.midtrans.com",
      // Datadog RUM/logs POST to the "browser-intake-*" family (e.g.
      // browser-intake-datadoghq.com), which is a distinct apex domain, NOT a
      // subdomain of datadoghq.com — CSP host wildcards only match labels
      // that precede the given suffix with a dot, so "*.datadoghq.com" does
      // NOT cover "browser-intake-datadoghq.com". Listed explicitly for the
      // default site (NEXT_PUBLIC_DATADOG_SITE=datadoghq.com); update this if
      // the site env var is ever changed to a different Datadog region.
      "connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co https://*.datadoghq.com https://browser-intake-datadoghq.com https://api.midtrans.com https://api.sandbox.midtrans.com https://app.midtrans.com https://app.sandbox.midtrans.com",
      "img-src 'self' data: blob: https:",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
    ].join("; ");
    return [
      // App pages — COOP untuk isolasi window, longgar untuk popup Snap
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
