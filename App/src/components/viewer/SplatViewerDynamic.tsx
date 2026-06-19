"use client";

/**
 * Dynamic (SSR-safe) wrapper untuk SplatViewer.
 * Gunakan komponen ini di page/layout — bukan SplatViewer langsung.
 */

import dynamic from "next/dynamic";

const SplatViewer = dynamic(() => import("./SplatViewer"), {
  ssr: false,
  loading: () => (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ background: "linear-gradient(145deg, #F5E6D3, #E8D5C0)" }}
    >
      <div
        className="w-12 h-12 rounded-xl animate-pulse"
        style={{ background: "#D4A574" }}
      />
    </div>
  ),
});

export default SplatViewer;
