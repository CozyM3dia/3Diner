"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import AuthShell from "../AuthShell";

/**
 * Halaman OTP — recreation 1:1 `otp.html` Dream POS (placeholder UI,
 * logic menyusul). Timer 02:00 berjalan murni di klien; input OTP sudah
 * auto-advance/backspace seperti otp.js template, tanpa submit logic.
 */
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
    <AuthShell>
      <div className="ap-mb4">
        <h3 className="ap-mb2">Masukkan OTP</h3>
        <p className="ap-mb0 ap-head-sub">
          Masukkan OTP yang dikirim ke email terdaftar
        </p>
      </div>

      <div className="ap-otp-row">
        {[0, 1, 2, 3].map((i) => (
          <input
            key={i}
            ref={(el) => {
              inputRefs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            className="ap-digit"
            aria-label={`Digit OTP ${i + 1}`}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
          />
        ))}
      </div>

      <div className="ap-otpline">
        <span className="ap-badge-danger">
          {mm}:{ss}
        </span>
        <button type="button" className="ap-resend">Kirim Ulang OTP</button>
      </div>

      <div className="ap-mb4">
        <button type="button" className="ap-btn ap-btn-primary">Verifikasi</button>
      </div>

      <div className="ap-foot">
        <p className="ap-mb0">
          Kembali ke
          <Link href="/auth/masuk" className="ap-link"> Masuk</Link>
        </p>
      </div>
    </AuthShell>
  );
}
