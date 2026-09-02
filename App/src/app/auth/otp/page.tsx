"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import AuthShell from "../AuthShell";
import { AuthFoot } from "@/components/ui/sign-in";

/** OTP — pratinjau. Perilaku yang sudah nyata di halaman ini: hitung mundur
 *  02:00, auto-advance antar kotak, dan backspace mundur. Verifikasi kode
 *  yang sungguhan berjalan di `/login`. */
export default function OtpPage() {
  const [sisa, setSisa] = useState(120);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    const t = setInterval(() => setSisa((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  const mm = String(Math.floor(sisa / 60)).padStart(2, "0");
  const ss = String(sisa % 60).padStart(2, "0");

  function handleChange(i: number, v: string) {
    if (v && i < 3) inputRefs.current[i + 1]?.focus(); // auto-advance
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !e.currentTarget.value && i > 0) {
      inputRefs.current[i - 1]?.focus(); // backspace mundur
    }
  }

  return (
    <AuthShell
      title="Masukkan kode"
      lede="Empat digit yang dikirim ke email terdaftar. Kode hangus setelah hitungan habis."
      cards={[
        {
          name: "Kode sekali pakai",
          meta: "Berlaku 2 menit",
          body: "Setelah habis, minta kode baru — kode lama tidak bisa dipakai lagi.",
          pills: [{ label: "Sekali pakai", tone: "teal" }],
        },
      ]}
    >
      <div className="au-fields">
        <p className="au-note">
          Pratinjau alur. Verifikasi kode yang aktif berjalan di{" "}
          <Link href="/login" className="au-link">
            /login
          </Link>
          .
        </p>

        <div className="au-otp au-el" style={{ "--d": 3 } as React.CSSProperties}>
          {[0, 1, 2, 3].map((i) => (
            <input
              key={i}
              ref={(el) => {
                inputRefs.current[i] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              className="au-digit"
              aria-label={`Digit OTP ${i + 1}`}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
            />
          ))}
        </div>

        <div className="au-otpline au-el" style={{ "--d": 4 } as React.CSSProperties}>
          <span className="au-timer" role="timer" aria-live="off">
            {mm}:{ss}
          </span>
          <button type="button" className="au-link">
            Kirim ulang kode
          </button>
        </div>

        <Link
          href="/login"
          className="au-submit au-el"
          style={{ "--d": 5 } as React.CSSProperties}
        >
          Verifikasi
        </Link>
      </div>

      <AuthFoot>
        Kode tidak masuk?{" "}
        <Link href="/auth/lupa-password" className="au-link">
          Kirim ulang dari awal
        </Link>
      </AuthFoot>
    </AuthShell>
  );
}
