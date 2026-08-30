import type { Metadata } from "next";
import Link from "next/link";
import { EyeOffIcon } from "lucide-react";
import AuthShell from "../AuthShell";

export const metadata: Metadata = { title: "Masuk | 3Diner" };

/**
 * Halaman Masuk — recreation 1:1 `login.html` Dream POS (placeholder UI,
 * logic menyusul; login asli masih di /login).
 */
export default function MasukPage() {
  return (
    <AuthShell>
      <div className="ap-mb4">
        <h3 className="ap-mb2">Hai, Selamat Datang Kembali !!!</h3>
        <p className="ap-mb0 ap-head-sub">
          Silakan masukkan kredensial kamu untuk masuk!
        </p>
      </div>

      <div className="ap-field">
        <label className="ap-label" htmlFor="email">
          Email<span className="ap-req"> *</span>
        </label>
        <input id="email" type="email" className="ap-input" placeholder="kamu@kafe.com" />
      </div>

      <div className="ap-field">
        <label className="ap-label" htmlFor="password">
          Password<span className="ap-req"> *</span>
        </label>
        <div className="ap-pass">
          <input id="password" type="password" className="ap-input" placeholder="••••••••" />
          <button type="button" className="ap-pass-toggle" aria-label="Tampilkan password">
            <EyeOffIcon size={16} />
          </button>
        </div>
      </div>

      <div className="ap-rowline">
        <label className="ap-check">
          <input type="checkbox" /> Ingat Saya
        </label>
        <Link href="/auth/lupa-password" className="ap-link">
          Lupa Password?
        </Link>
      </div>

      <div className="ap-mb4">
        <button type="button" className="ap-btn ap-btn-primary">Masuk</button>
      </div>

      <div className="ap-or ap-mb4">
        <span>atau lanjutkan dengan</span>
      </div>

      <div className="ap-social">
        <button type="button" className="ap-btn ap-btn-white">
          {/* eslint-disable-next-line @next/next/no-img-element -- ikon Google multicolor (SVG template) */}
          <img src="/dp-auth/google.svg" alt="google" /> Google
        </button>
        <button type="button" className="ap-btn ap-btn-white">
          {/* eslint-disable-next-line @next/next/no-img-element -- ikon Facebook (SVG template) */}
          <img src="/dp-auth/fb.svg" alt="facebook" /> Facebook
        </button>
      </div>

      <div className="ap-foot">
        <p className="ap-mb0">
          Belum punya akun?
          <Link href="/auth/daftar" className="ap-link"> Daftar</Link>
        </p>
      </div>
    </AuthShell>
  );
}
