import type { Metadata } from "next";
import Link from "next/link";
import { EyeOffIcon } from "lucide-react";
import AuthShell from "../AuthShell";

export const metadata: Metadata = { title: "Daftar | 3Diner" };

/**
 * Halaman Daftar — recreation 1:1 `register.html` Dream POS (placeholder UI,
 * logic menyusul).
 */
export default function DaftarPage() {
  return (
    <AuthShell>
      <div className="ap-mb4">
        <h3 className="ap-mb2">Daftar</h3>
        <p className="ap-mb0 ap-head-sub">
          Dan mari mulai dengan uji coba gratis kamu
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

      <div className="ap-field">
        <label className="ap-label" htmlFor="confirm-password">
          Konfirmasi Password<span className="ap-req"> *</span>
        </label>
        <div className="ap-pass">
          <input id="confirm-password" type="password" className="ap-input" placeholder="••••••••" />
          <button type="button" className="ap-pass-toggle" aria-label="Tampilkan konfirmasi password">
            <EyeOffIcon size={16} />
          </button>
        </div>
      </div>

      <div className="ap-check ap-mb4">
        <input id="agree" type="checkbox" />
        <label htmlFor="agree" className="ap-check ap-mb0" style={{ gap: 0 }}>
          Setuju dengan <a href="#" className="ap-plain">&nbsp;Syarat</a> &amp;
          <a href="#" className="ap-plain">&nbsp;Kebijakan Privasi</a>
        </label>
      </div>

      <div className="ap-mb4">
        <button type="button" className="ap-btn ap-btn-primary">Daftar</button>
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
          Sudah punya akun?
          <Link href="/auth/masuk" className="ap-link"> Masuk</Link>
        </p>
      </div>
    </AuthShell>
  );
}
