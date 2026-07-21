"use client";

import { useEffect, useState } from "react";

export type ResponsiveRender = (idPrefix: string) => React.ReactNode;

interface ResponsiveDataViewProps {
  /** Render function — id yang dihasilkan WAJIB di-namespace dengan idPrefix. */
  table: ResponsiveRender;
  cards: ResponsiveRender;
  breakpoint?: string;
  className?: string;
}

function useIsDesktop(bp: string) {
  const [is, setIs] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia(bp);
    const on = () => setIs(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [bp]);
  return is; // null = mode belum diketahui (SSR / first paint)
}

/** Kontrak a11y (spec): hanya representasi aktif yang tampil, fokusable,
 *  dan ter-ekspos ke assistive technology.
 *  - mode null  -> keduanya dirender, yang non-aktif display:none via kelas
 *    breakpoint CSS (display:none = keluar dari focus order + a11y tree)
 *  - mode diketahui -> HANYA cabang aktif yang tetap ter-mount
 *  Render function menerima idPrefix berbeda sehingga fase dual-render
 *  singkat tidak pernah menghasilkan id duplikat. */
export default function ResponsiveDataView({
  table,
  cards,
  breakpoint = "(min-width: 1024px)",
  className = "",
}: ResponsiveDataViewProps) {
  const isDesktop = useIsDesktop(breakpoint);

  if (isDesktop === true) return <div className={className}>{table("rdv-table")}</div>;
  if (isDesktop === false) return <div className={className}>{cards("rdv-cards")}</div>;

  return (
    <div className={className}>
      <div className="hidden lg:block">{table("rdv-table")}</div>
      <div className="lg:hidden">{cards("rdv-cards")}</div>
    </div>
  );
}
