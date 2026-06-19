import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile ESM-only packages
  transpilePackages: ["@mkkellogg/gaussian-splats-3d", "three"],

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
      // App pages — COOP untuk isolasi window (tidak perlu COEP karena kita
      // set sharedMemoryForWorkers: false di viewer, jadi tidak butuh SharedArrayBuffer)
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
