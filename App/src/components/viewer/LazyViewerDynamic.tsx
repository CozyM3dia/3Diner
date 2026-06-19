"use client";

import dynamic from "next/dynamic";

// No SSR — LazyViewer uses browser-only APIs (onClick, dynamic import of WebGL)
// Must be a Client Component in Next.js 16+ to use dynamic({ ssr: false })
export default dynamic(() => import("./LazyViewer"), { ssr: false });
