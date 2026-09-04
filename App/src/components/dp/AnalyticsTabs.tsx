"use client";

import Link from "next/link";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import type { LembarAnalitik } from "@/components/dp/AnalyticsHeader";

/** Tab lembar sebagai segmen pil.
 *
 *  Tetap `<a>` dengan `aria-current`: ia navigasi antar-halaman yang menyamar
 *  jadi tab. Latar putih pindah antar-segmen lewat `layoutId`, jadi perpindahan
 *  terbaca sebagai satu benda yang bergeser, bukan dua kotak yang berkedip —
 *  dan karena setiap tab adalah halaman terpisah, latarnya ikut berpindah
 *  begitu rute baru terpasang.
 */
export default function AnalyticsTabs({
  lembar,
  aktif,
}: {
  lembar: { key: LembarAnalitik; label: string; href: string }[];
  aktif: LembarAnalitik;
}) {
  const diam = useReducedMotion();

  return (
    <LayoutGroup id="an-tabs">
      <nav className="an-tabs" aria-label="Lembar analitik">
        {lembar.map((l) => {
          const on = l.key === aktif;
          return (
            <Link
              key={l.key}
              href={l.href as never}
              className={`an-tab${on ? " is-on" : ""}`}
              aria-current={on ? "page" : undefined}
            >
              {on &&
                (diam ? (
                  <span className="an-tab-bg" aria-hidden />
                ) : (
                  <motion.span
                    layoutId="an-tab-bg"
                    className="an-tab-bg"
                    aria-hidden
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                ))}
              <span className="an-tab-label">{l.label}</span>
            </Link>
          );
        })}
      </nav>
    </LayoutGroup>
  );
}
