"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { EyeIcon, EyeOffIcon, LogInIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { resolveHomeRoute } from "@/lib/auth-routing";

const ALASAN: Record<string, string> = {
  "bukan-staf": "Akun ini belum terdaftar sebagai staf kafe mana pun. Hubungi pemilik kafe.",
  nonaktif: "Akses akun ini sedang dinonaktifkan. Hubungi pemilik kafe.",
};

const INGAT_KEY = "login-ingat-email";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  // Prefill dari "Ingat email saya" — dibaca setelah mount supaya render server
  // dan client identik (tidak ada hydration mismatch). localStorage adalah
  // sistem eksternal yang tidak ada saat SSR, jadi ini penggunaan effect yang
  // disengaja, bukan cascading state.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(INGAT_KEY);
      if (saved) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- sinkronisasi satu kali dari storage browser, tidak bisa dilakukan saat render server
        setEmail(saved);
        setRemember(true);
      }
    } catch {
      /* localStorage bisa terkunci (private mode); abaikan saja. */
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Ingat email saya: hanya email, tidak pernah password.
      try {
        if (remember) window.localStorage.setItem(INGAT_KEY, email);
        else window.localStorage.removeItem(INGAT_KEY);
      } catch {
        /* storage penuh/terkunci — fitur ingat boleh gagal diam. */
      }

      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setError("Email atau password salah.");
        setLoading(false);
        return;
      }

      // Peran yang menentukan tujuan, bukan pilihan di layar ini: pemilik ke
      // konsolnya, kasir ke antrean pesanan.
      const result = await resolveHomeRoute();
      if (result.home === null) {
        // Kegagalan memeriksa ≠ bukan staf: sesi tetap hidup supaya orang bisa
        // mencoba lagi tanpa mengetik ulang password.
        setError(
          result.reason === "gagal-muat"
            ? "Gagal memeriksa peranmu. Coba lagi."
            : ALASAN[result.reason],
        );
        setLoading(false);
        return;
      }

      router.push(result.home);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-split">
      {/* ── Kolom kiri: form (struktur Dream POS, isi 3Diner) ── */}
      <section className="login-left">
        <div className="login-logo">
          <Image src="/brand/logo-3diner-mark.svg" alt="" width={38} height={38} priority />
          <span>3Diner</span>
        </div>

        <h1 className="login-hello">Hai, selamat datang kembali!</h1>
        <p className="login-sub">Masuk untuk mengelola menu, pesanan, dan stok kafe kamu.</p>

        <form onSubmit={handleSubmit} className="login-form" noValidate>
          <div className="login-field">
            <label className="login-label" htmlFor="email">
              Email <span className="req">*</span>
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="login-input"
              placeholder="kamu@kafe.com"
            />
          </div>

          <div className="login-field">
            <label className="login-label" htmlFor="password">
              Password <span className="req">*</span>
            </label>
            <div className="login-input-wrap">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="login-input"
                placeholder="••••••••"
              />
              <button
                type="button"
                className="login-eye"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
              >
                {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
              </button>
            </div>
          </div>

          <div className="login-row">
            <label className="login-check">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Ingat email saya
            </label>
            {/* Belum ada alur reset password di backend — jujur, bukan link mati
                ala template. Penjelasannya muncul hanya saat link diklik. */}
            <button
              type="button"
              className="login-link"
              onClick={() =>
                setNote("Reset password akan mengirim tautan ke email — fitur ini menyusul. Hubungi pemilik kafe kamu untuk bantuan.")
              }
            >
              Lupa password?
            </button>
          </div>
          {note && (
            <p className="login-note" aria-live="polite">
              {note}
            </p>
          )}

          {error && (
            <p className="login-alert" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="login-submit">
            {loading ? "Memproses…" : "Masuk"}
            {!loading && <LogInIcon size={16} aria-hidden="true" />}
          </button>
        </form>

        <p className="login-foot">3Diner Dashboard · Konsol Owner & Kasir</p>
      </section>

      {/* ── Kolom kanan: panel brand ── */}
      <section className="login-right" aria-hidden="true">
        <span className="login-orbit o1" />
        <span className="login-orbit o2" />
        <span className="login-glow" />

        <p className="login-kicker">Smart Menu · 3D &amp; AR</p>
        <h2 className="login-headline">
          Kendali penuh kafe kamu, dengan menu yang bisa dilihat tamu dalam 3D.
        </h2>
        <p className="login-rightsub">
          Kelola menu, varian, resep, dan stok dari satu konsol — lengkap dengan model
          3D dan pratinjau AR untuk setiap hidangan.
        </p>

        <div className="login-glass">
          <div className="login-glass-row">
            <span className="login-thumb" />
            <div>
              <span className="login-glass-name">Grilled Salmon Steak</span>
              <span className="login-glass-meta">Rp 48.000 · Tayang terjadwal</span>
            </div>
          </div>
          <div className="login-pills">
            <span className="dv2-pill" style={{ "--pill": "var(--semantic-teal)" } as React.CSSProperties}>
              3D ready
            </span>
            <span className="dv2-pill" style={{ "--pill": "var(--semantic-success)" } as React.CSSProperties}>
              AR ready
            </span>
          </div>
          <p className="login-glass-cap">
            Contoh kartu menu dengan model 3D — tamu memutar hidangan sebelum memesan.
          </p>
        </div>
      </section>
    </main>
  );
}
