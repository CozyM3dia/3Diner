"use client";

import { useLayoutEffect } from "react";
import { bacaTemaDapur } from "@/lib/kitchen-theme";

/** Menyetel atribut KDS juga pada navigasi klien. Script mentah di nested
 * layout tidak dieksekusi React saat berpindah route, sehingga tema dahulu
 * bisa tertinggal dari halaman sebelumnya. */
export default function KitchenThemeSync({ mode }: { mode: "standalone" | "console" }) {
  useLayoutEffect(() => {
    const html = document.documentElement;
    const sync = () => {
      if (mode === "console") {
        html.dataset.kds = html.dataset.theme === "light" ? "terang" : "gelap";
      } else {
        html.dataset.kds = bacaTemaDapur();
      }
    };
    sync();

    if (mode !== "console") return;
    const observer = new MutationObserver(sync);
    observer.observe(html, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, [mode]);

  return null;
}
