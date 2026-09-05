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
      // Network-first for public navigation pages only.
      // Checkout/order pages must receive the current HTML before falling back
      // to cache; serving an old HTML shell with new immutable CSS/JS chunk
      // hashes can leave the page completely unstyled after a deployment.
      // Dashboard routes are excluded: they require auth and serve real-time data.
      {
        urlPattern: /^https:\/\/3diner\.vercel\.app\/(?!dashboard(?:\/|$)|dashboard-v2(?:\/|$)|kasir(?:\/|$)|dapur(?:\/|$)|login(?:\/|$)|api(?:\/|$)|_next(?:\/|$))[^_].*/,
        handler: "NetworkFirst",
        options: {
          cacheName: "pages-cache-v2",
          networkTimeoutSeconds: 5,
          expiration: { maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 },
        },
      },
      // Cache-first for Supabase storage (menu images + 3D models)
      {
        urlPattern: /^https:\/\/zvkmcbvckuupjsdftsyz\.supabase\.co\/storage\/.*/,
        handler: "CacheFirst",
        options: {
          cacheName: "media-cache",
          expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 },
        },
      },
      // Cache-first for R2-hosted 3D assets (not covered by the Supabase rule)
      {
        urlPattern: /^https:\/\/.*\.r2\.dev\/.*\.(glb|gltf|usdz|splat|ply)(\?.*)?$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "model-cache",
          expiration: { maxEntries: 40, maxAgeSeconds: 30 * 24 * 60 * 60 },
        },
      },
      // Stale-while-revalidate for Next.js static assets
      {
        urlPattern: /\/_next\/static\/.*/,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "next-static-cache-v2",
          expiration: { maxAgeSeconds: 30 * 24 * 60 * 60 },
        },
      },
    ],
  },
});

// Clerk loads its browser runtime and session APIs from the instance domain.
// Keep the allowlist explicit so the login page can bootstrap under the app CSP.
const clerkOrigins = "https://*.clerk.accounts.dev https://*.clerk.com https://*.clerk.dev";
const clerkConnectOrigins = `${clerkOrigins} wss://*.clerk.accounts.dev wss://*.clerk.com wss://*.clerk.dev`;
const developmentScriptSources = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
const captchaOrigin = "https://challenges.cloudflare.com";

const nextConfig: NextConfig = {
  // The framework's floating dev-tools badge overlaps the console logout
  // affordance at narrow widths. Request insights remain available in logs;
  // the badge itself is not part of the product UI.
  devIndicators: false,
  // The app is commonly opened through 127.0.0.1 during local testing.
  allowedDevOrigins: ["127.0.0.1", "localhost"],

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
      `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${developmentScriptSources} https://app.midtrans.com https://app.sandbox.midtrans.com ${clerkOrigins} ${captchaOrigin}`,
      `frame-src 'self' https://app.midtrans.com https://app.sandbox.midtrans.com ${clerkOrigins} ${captchaOrigin}`,
      // Datadog RUM/logs POST to the "browser-intake-*" family (e.g.
      // browser-intake-datadoghq.com), which is a distinct apex domain, NOT a
      // subdomain of datadoghq.com — CSP host wildcards only match labels
      // that precede the given suffix with a dot, so "*.datadoghq.com" does
      // NOT cover "browser-intake-datadoghq.com". Listed explicitly for the
      // default site (NEXT_PUBLIC_DATADOG_SITE=datadoghq.com); update this if
      // the site env var is ever changed to a different Datadog region.
      `connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co https://*.datadoghq.com https://browser-intake-datadoghq.com https://api.midtrans.com https://api.sandbox.midtrans.com https://app.midtrans.com https://app.sandbox.midtrans.com ${clerkConnectOrigins} ${captchaOrigin}`,
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
