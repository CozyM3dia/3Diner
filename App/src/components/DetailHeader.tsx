"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

interface DetailHeaderProps {
  cafeName: string;
  slug: string;
}

export default function DetailHeader({ cafeName, slug }: DetailHeaderProps) {
  const router = useRouter();

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center gap-3 px-4 py-3"
      style={{
        background: "rgba(253,253,253,0.88)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid #CFD9E4",
      }}
    >
      <button
        onClick={() => router.push(`/${slug}`)}
        className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform shrink-0"
        style={{ background: "#E0E7EE" }}
        aria-label="Kembali ke menu"
      >
        <ArrowLeft size={18} color="#022C60" strokeWidth={2.5} />
      </button>

      <p className="text-sm font-semibold truncate" style={{ color: "#022C60" }}>
        {cafeName}
      </p>
    </header>
  );
}
