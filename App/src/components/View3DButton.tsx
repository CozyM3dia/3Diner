"use client";

import { useState } from "react";
import { Box } from "lucide-react";
import dynamic from "next/dynamic";

// ModelViewer is heavy — only bundle it after the user taps
const ModelViewer = dynamic(() => import("@/components/viewer/ModelViewer"), {
  ssr: false,
});

interface View3DButtonProps {
  modelUrl: string;
  menuName: string;
}

export default function View3DButton({ modelUrl, menuName }: View3DButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl font-semibold text-sm active:scale-95 transition-transform"
        style={{
          background: "#F5E6D3",
          color: "#8B5E3C",
          border: "1.5px solid #D4A574",
        }}
      >
        <Box size={16} strokeWidth={2} />
        Lihat 3D Model
      </button>

      {open && (
        <ModelViewer
          url={modelUrl}
          menuName={menuName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
