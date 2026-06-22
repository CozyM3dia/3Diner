"use client";

import { useState } from "react";
import { Loader2, Save, Check, AlertCircle } from "lucide-react";
import { updateCafeSettings } from "@/lib/dashboard-actions";
import type { Cafe } from "@/types";

const inputStyle: React.CSSProperties = {
  background: "#132136",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#E9EEF6",
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#5A7898" }}>
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] mt-1.5" style={{ color: "#5A7898" }}>{hint}</p>}
    </div>
  );
}

export default function SettingsForm({ cafe }: { cafe: Cafe }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const inputCls = "dash-input w-full px-3.5 py-2.5 rounded-xl text-sm outline-none";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaved(false);
    setSaving(true);
    const res = await updateCafeSettings(new FormData(e.currentTarget));
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.1)", color: "#FCA5A5" }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="rounded-2xl p-5 space-y-4 dash-reveal dash-d1" style={{ background: "#0D1829", border: "1px solid rgba(255,255,255,0.07)" }}>
        <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#5A7898" }}>Identitas</p>
        <Field label="Nama Kafe *">
          <input name="nama_cafe" defaultValue={cafe.nama_cafe} required className={inputCls} style={inputStyle} />
        </Field>
        <Field label="Alamat">
          <input name="alamat_cafe" defaultValue={cafe.alamat_cafe} className={inputCls} style={inputStyle} />
        </Field>
        <Field label="Sapaan / Tagline" hint="Tampil di atas nama kafe pada halaman menu">
          <input name="greeting" defaultValue={cafe.greeting ?? ""} className={inputCls} style={inputStyle} placeholder="Selamat datang di…" />
        </Field>
      </div>

      <div className="rounded-2xl p-5 space-y-4 dash-reveal dash-d2" style={{ background: "#0D1829", border: "1px solid rgba(255,255,255,0.07)" }}>
        <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#5A7898" }}>Tampilan & Tautan</p>
        <Field label="URL Logo">
          <input name="logo_url" defaultValue={cafe.logo_url ?? ""} className={inputCls} style={inputStyle} placeholder="https://…/logo.png" />
        </Field>
        <Field label="URL Foto Sampul">
          <input name="cover_url" defaultValue={cafe.cover_url ?? ""} className={inputCls} style={inputStyle} placeholder="https://…/cover.jpg" />
        </Field>
        <Field label="URL Ulasan Google Maps" hint="Tombol 'Beri Ulasan' akan muncul di halaman menu jika diisi">
          <input name="google_maps_review_url" defaultValue={cafe.google_maps_review_url ?? ""} className={inputCls} style={inputStyle} placeholder="https://g.page/r/…/review" />
        </Field>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="dash-btn inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
        style={{ background: saved ? "#22D3A6" : "#FD5002", opacity: saving ? 0.7 : 1, transition: "background 200ms ease-out, filter 0.15s, transform 0.12s" }}
      >
        {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <Check size={15} /> : <Save size={15} />}
        {saved ? "Tersimpan" : "Simpan Perubahan"}
      </button>
    </form>
  );
}
