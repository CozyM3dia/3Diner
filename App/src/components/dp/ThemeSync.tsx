"use client";

import { useEffect } from "react";
import { getStoredTheme, resolveTheme } from "@/lib/theme";

/** Penegak tema pasca-hidrasi (safety net, bukan pengganti anti-FOUC):
 *  skrip inline di <head> layout root sudah men-set <html data-theme>
 *  sebelum paint. Layer ini memastikan temuan itu tetap berlaku setelah
 *  hidrasi React — mis. hidrasi menghapus atribut, storage dibaca lebih
 *  dulu oleh layanan lain, atau pengguna mengubah preferensi sistem
 *  saat halaman terbuka (mode "system"). */
export default function ThemeSync() {
  useEffect(() => {
    const terapkan = () => {
      const stored = getStoredTheme();
      const prefersDark =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.dataset.theme = resolveTheme(stored, prefersDark);
    };
    terapkan();
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", terapkan);
    return () => mq.removeEventListener("change", terapkan);
  }, []);
  return null;
}
