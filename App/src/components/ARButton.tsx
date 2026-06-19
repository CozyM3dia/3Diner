"use client";

import { useState } from "react";
import { Glasses } from "lucide-react";
import dynamic from "next/dynamic";

// Lazy-load ARSession so the heavy GS + Three.js code
// is only downloaded when the user actually taps the button
const ARSession = dynamic(
  () => import("@/components/viewer/ARSession"),
  { ssr: false }
);

interface ARButtonProps {
  modelUrl: string;
  menuName: string;
}

export default function ARButton({ modelUrl, menuName }: ARButtonProps) {
  const [showAR, setShowAR] = useState(false);

  return (
    <>
      {/* "View in AR" trigger button */}
      <button
        onClick={() => setShowAR(true)}
        className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm active:scale-95 transition-all"
        style={{
          background: "linear-gradient(135deg, #8B5E3C, #C4956A)",
          color: "#FDF6EC",
          boxShadow: "0 4px 20px rgba(139,94,60,0.35)",
        }}
      >
        <Glasses size={18} strokeWidth={2} />
        View in AR
      </button>

      {/* Full-screen AR overlay — mounts only when showAR is true */}
      {showAR && (
        <ARSession
          url={modelUrl}
          menuName={menuName}
          onClose={() => setShowAR(false)}
        />
      )}
    </>
  );
}
