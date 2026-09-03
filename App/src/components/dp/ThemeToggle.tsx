"use client";

import { useSyncExternalStore } from "react";
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

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const media = typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;
  const notify = () => onChange();
  window.addEventListener("storage", notify);
  media?.addEventListener("change", notify);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", notify);
    media?.removeEventListener("change", notify);
  };
}

function notifyThemeChanged() {
  for (const listener of listeners) listener();
}

export default function ThemeToggle() {
  // Snapshot server sengaja stabil. Setelah hidrasi, React membaca snapshot
  // browser dan memperbarui ikon tanpa membuang markup server.
  const mode = useSyncExternalStore(subscribe, actualMode, () => "light");

  const toggle = () => {
    const next: Mode = actualMode() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(LS_KEY, next);
    } catch {
      /* storage penuh/diblokir — tema masih berlaku untuk sesi ini */
    }
    notifyThemeChanged();
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
