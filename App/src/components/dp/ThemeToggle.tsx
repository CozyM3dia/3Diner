"use client";

import { useState } from "react";
import { MoonIcon, SunIcon } from "lucide-react";
import "./theme-toggle.css";

/** Key localStorage = milik Agent A (kontrak tema), dibaca/tulis langsung
 *  di sini — self-contained, tanpa import lib/theme. */
const LS_KEY = "tema-3diner";
type Mode = "light" | "dark";

/** Kondisi tema aktual: dataset.theme bila Agent A sudah menyetelnya, kalau
 *  "system" (atau belum ada) resolusi dari matchMedia. Aman untuk SSR. */
function actualMode(): Mode {
  if (typeof document !== "undefined") {
    const t = document.documentElement.dataset.theme;
    if (t === "dark") return "dark";
    if (t === "light") return "light";
  }
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }
  return "light";
}

export default function ThemeToggle() {
  // Initializer dijalankan saat render pertama; di server tetap "light",
  // di klien dibaca dari kondisi aktual (dataset/matchMedia).
  const [mode, setMode] = useState<Mode>(() => (typeof window === "undefined" ? "light" : actualMode()));

  const toggle = () => {
    const next: Mode = actualMode() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(LS_KEY, next);
    } catch {
      /* storage penuh/diblokir — tema masih berlaku untuk sesi ini */
    }
    setMode(next);
  };

  return (
    <button
      type="button"
      className="dp-iconbtn dp-theme-toggle"
      onClick={toggle}
      aria-label={mode === "dark" ? "Ganti ke mode terang" : "Ganti ke mode gelap"}
      title={mode === "dark" ? "Mode terang" : "Mode gelap"}
    >
      {mode === "dark" ? <SunIcon className="dp-theme-icon" /> : <MoonIcon className="dp-theme-icon" />}
    </button>
  );
}
