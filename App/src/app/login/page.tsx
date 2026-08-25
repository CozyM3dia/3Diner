"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { EyeIcon, EyeOffIcon, LogInIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { resolveHomeRoute } from "@/lib/auth-routing";

const ALASAN: Record<string, string> = {
  "bukan-staf": "Akun ini belum terhubung ke kafe mana pun. Hubungi pemilik kafe untuk diundang.",
  nonaktif: "Akses akun ini sedang dinonaktifkan. Hubungi pemilik kafe.",
};

const INGAT_KEY = "login-ingat-email";

type Mode = "login" | "daftar";
type SignupOk = { email: string; needsVerify: boolean };

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");

  // ── state login ──
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  // ── state daftar ──
  const [sEmail, setSEmail] = useState("");
  const [sPassword, setSPassword] = useState("");
  const [sShowPw, setSShowPw] = useState(false);
  const [wa, setWa] = useState("");
  const [refOpen, setRefOpen] = useState(false);
  const [setuju, setSetuju] = useState(false);
  const [sError, setSError] = useState("");
  const [ok, setOk] = useState<SignupOk | null>(null);
  const [signingUp, setSigningUp] = useState(false);

  // Prefill "Ingat email saya" — localStorage adalah sistem eksternal yang
  // tidak ada saat SSR; sinkronisasi sekali pasca-mount memang lewat effect.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(INGAT_KEY);
      if (saved) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- sinkronisasi satu kali dari storage browser
        setEmail(saved);
        setRemember(true);
      }
    } catch {
      /* storage terkunci (private mode) — fitur ingat boleh gagal diam. */
    }
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
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
        return;
      }

      // Peran yang menentukan tujuan: pemilik ke konsolnya, kasir ke antrean.
      const result = await resolveHomeRoute();
      if (result.home === null) {
        setError(
          result.reason === "gagal-muat"
            ? "Gagal memeriksa peranmu. Coba lagi."
            : ALASAN[result.reason],
        );
        return;
      }

      router.push(result.home);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  function waDigits() {
    return wa.replace(/\D/g, "");
  }

  const signupReady =
    /^\S+@\S+\.\S+$/.test(sEmail) && sPassword.length >= 8 && waDigits().length >= 9 && setuju;

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!signupReady) return;
    setSError("");
    setSigningUp(true);
    setOk(null);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: sEmail,
        password: sPassword,
        options: {
          // Nomor WA disimpan sebagai metadata akun — data tetap tersimpan walau
          // verifikasi OTP-nya sendiri belum ada (butuh provider WhatsApp).
          data: { whatsapp: wa, full_name: sEmail.split("@")[0] },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (error) {
        setSError(
          error.message.includes("already")
            ? "Email ini sudah terdaftar. Coba masuk, atau gunakan email lain."
            : "Pendaftaran gagal. Coba lagi.",
        );
        return;
      }

      setOk({ email: sEmail, needsVerify: !data.session });
    } finally {
      setSigningUp(false);
    }
  }

  return (
    <main className="login-split">
      {/* ── Kolom kiri: form (tab Masuk / Daftar ala Majoo) ── */}
      <section className="login-left">
        <div className="login-logo">
          <Image src="/brand/logo-3diner-mark.svg" alt="" width={38} height={38} priority />
          <span>3Diner</span>
        </div>

        <div className="login-tabs" role="tablist" aria-label="Masuk atau daftar">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            className="login-tab"
            onClick={() => setMode("login")}
          >
            Masuk
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "daftar"}
            className="login-tab"
            onClick={() => setMode("daftar")}
          >
            Daftar
          </button>
        </div>

        {/* ════════ VIEW MASUK ════════ */}
        {mode === "login" && (
          <>
            <h1 className="login-hello">Hai, selamat datang kembali!</h1>
            <p className="login-sub">Masuk untuk mengelola menu, pesanan, dan stok kafe kamu.</p>

            <form onSubmit={handleLogin} className="login-form" noValidate>
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
                {/* Reset password butuh alur email backend — jujur, bukan link mati. */}
                <button
                  type="button"
                  className="login-link"
                  onClick={() =>
                    setNote(
                      "Reset password akan mengirim tautan ke email — fitur ini menyusul. Hubungi pemilik kafe kamu untuk bantuan.",
                    )
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

            <p className="login-foot">
              Belum punya akun?{" "}
              <button type="button" className="login-link" onClick={() => setMode("daftar")}>
                Daftar
              </button>
            </p>
          </>
        )}

        {/* ════════ VIEW DAFTAR (struktur Majoo) ════════ */}
        {mode === "daftar" && (
          <>
            <h1 className="login-hello">Daftar Akun</h1>
            <p className="login-sub">Buat akun untuk mulai mengelola kafe kamu.</p>

            <form onSubmit={handleSignup} className="login-form" noValidate>
              <div className="login-field">
                <label className="login-label" htmlFor="s-email">
                  Email <span className="req">*</span>
                </label>
                <input
                  id="s-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={sEmail}
                  onChange={(e) => setSEmail(e.target.value)}
                  className="login-input"
                  placeholder="Contoh: kamu@kafe.com"
                />
              </div>

              <div className="login-field">
                <label className="login-label" htmlFor="s-password">
                  Password <span className="req">*</span>
                </label>
                <div className="login-input-wrap">
                  <input
                    id="s-password"
                    type={sShowPw ? "text" : "password"}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={sPassword}
                    onChange={(e) => setSPassword(e.target.value)}
                    className="login-input"
                    placeholder="Minimal 8 karakter"
                  />
                  <button
                    type="button"
                    className="login-eye"
                    onClick={() => setSShowPw((s) => !s)}
                    aria-label={sShowPw ? "Sembunyikan password" : "Tampilkan password"}
                  >
                    {sShowPw ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                  </button>
                </div>
              </div>

              <div className="login-field">
                <label className="login-label" htmlFor="s-wa">
                  Nomor WhatsApp <span className="req">*</span>
                </label>
                <div className="signup-wa">
                  <div className="login-input-wrap">
                    <input
                      id="s-wa"
                      type="tel"
                      required
                      inputMode="tel"
                      value={wa}
                      onChange={(e) => setWa(e.target.value)}
                      className="login-input"
                      placeholder="Contoh: 0812 xxxx xxxx"
                    />
                  </div>
                  {/* Verifikasi OTP butuh provider WhatsApp yang belum ada —
                      disabled dengan alasan, sesuai kriteria induk §9. */}
                  <button type="button" className="signup-verif" disabled aria-label="Verifikasi nomor WhatsApp — menyusul">
                    Verifikasi
                  </button>
                </div>
              </div>

              <p className="signup-referral">
                Punya kode referral?{" "}
                <button
                  type="button"
                  className="login-link"
                  onClick={() => setRefOpen((o) => !o)}
                >
                  {refOpen ? "Tutup" : "Gunakan"}
                </button>
              </p>
              {refOpen && (
                <div className="login-field signup-refwrap show">
                  <label className="login-label" htmlFor="s-ref">
                    Kode referral
                  </label>
                  <input
                    id="s-ref"
                    type="text"
                    className="login-input"
                    placeholder="Masukkan kode referral"
                  />
                </div>
              )}

              <label className="login-check">
                <input
                  type="checkbox"
                  checked={setuju}
                  onChange={(e) => setSetuju(e.target.checked)}
                />
                Dengan mendaftar, saya menyatakan telah membaca dan menyetujui Ketentuan
                Layanan &amp; Kebijakan Privasi 3Diner.
              </label>

              {sError && (
                <p className="login-alert" role="alert">
                  {sError}
                </p>
              )}

              {ok && (
                <div className="signup-ok" role="status">
                  Akun untuk <b>{ok.email}</b> berhasil dibuat.
                  {ok.needsVerify
                    ? " Cek kotak masuk email kamu untuk tautan verifikasi, lalu masuk dari tab Masuk."
                    : " Kamu sudah bisa masuk dari tab Masuk."}
                </div>
              )}

              <button type="submit" disabled={!signupReady || signingUp} className="login-submit">
                {signingUp ? "Mendaftarkan…" : "Daftar"}
              </button>
            </form>

            <p className="login-foot">
              Sudah punya akun?{" "}
              <button type="button" className="login-link" onClick={() => setMode("login")}>
                Masuk
              </button>
            </p>
          </>
        )}
      </section>

      {/* ── Kolom kanan: panel brand dengan ilustrasi (ala Dream POS) ── */}
      <section className="login-right" aria-hidden="true">
        <span className="login-orbit o1" />
        <span className="login-orbit o2" />
        <span className="login-glow" />

        <p className="login-kicker">Smart Menu · 3D &amp; AR</p>
        <h2 className="login-headline">
          Kendali penuh kafe kamu, dengan menu yang bisa dilihat tamu dalam 3D.
        </h2>
        <p className="login-rightsub">
          Kelola menu, varian, resep, dan stok dari satu konsol — lengkap dengan model 3D
          dan pratinjau AR untuk setiap hidangan.
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

        {/* Ilustrasi kanan-bawah: HP hologram menu (aset marketing existing). */}
        <div className="login-figure" />
      </section>
    </main>
  );
}
