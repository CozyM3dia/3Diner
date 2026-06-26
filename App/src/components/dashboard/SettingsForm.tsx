"use client";

import { useState } from "react";
import Image from "next/image";
import { Loader2, Save, Check, AlertCircle, MapPin, Store, Star } from "lucide-react";
import { updateCafeSettings } from "@/lib/dashboard-actions";
import FileUpload from "./FileUpload";
import PhoneMockup from "./PhoneMockup";
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

  // Controlled state to drive the live preview
  const [nama, setNama] = useState(cafe.nama_cafe ?? "");
  const [alamat, setAlamat] = useState(cafe.alamat_cafe ?? "");
  const [greeting, setGreeting] = useState(cafe.greeting ?? "");
  const [logoUrl, setLogoUrl] = useState(cafe.logo_url ?? "");
  const [coverUrl, setCoverUrl] = useState(cafe.cover_url ?? "");
  const [reviewUrl, setReviewUrl] = useState(cafe.google_maps_review_url ?? "");

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
    <div className="flex flex-col-reverse gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_350px] lg:gap-10 lg:items-start">
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.1)", color: "#FCA5A5" }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Identitas */}
      <div className="rounded-2xl p-5 space-y-4 dash-reveal dash-d1" style={{ background: "#0D1829", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-2">
          <Store size={14} style={{ color: "#FD5002" }} />
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#5A7898" }}>Identitas</p>
        </div>
        <Field label="Nama Kafe *">
          <input name="nama_cafe" value={nama} onChange={(e) => setNama(e.target.value)} required className={inputCls} style={inputStyle} />
        </Field>
        <Field label="Alamat">
          <input name="alamat_cafe" value={alamat} onChange={(e) => setAlamat(e.target.value)} className={inputCls} style={inputStyle} />
        </Field>
        <Field label="Sapaan / Tagline" hint="Tampil di atas nama kafe pada halaman menu">
          <input name="greeting" value={greeting} onChange={(e) => setGreeting(e.target.value)} className={inputCls} style={inputStyle} placeholder="Selamat datang di…" />
        </Field>
      </div>

      {/* Branding — uploads */}
      <div className="rounded-2xl p-5 space-y-4 dash-reveal dash-d2" style={{ background: "#0D1829", border: "1px solid rgba(255,255,255,0.07)" }}>
        <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#5A7898" }}>Branding</p>
        <FileUpload
          name="logo_url"
          kind="logo"
          label="Logo Kafe"
          variant="image"
          accept="image/png,image/jpeg,image/webp,image/avif,image/svg+xml"
          hint="Disarankan persegi (1:1), PNG transparan · maks 30MB"
          defaultUrl={cafe.logo_url}
          onChange={setLogoUrl}
        />
        <FileUpload
          name="cover_url"
          kind="cover"
          label="Foto Sampul"
          variant="image"
          accept="image/png,image/jpeg,image/webp,image/avif"
          hint="Rasio lebar (16:9), tampil di atas halaman menu · maks 30MB"
          defaultUrl={cafe.cover_url}
          onChange={setCoverUrl}
        />
      </div>

      {/* Tautan */}
      <div className="rounded-2xl p-5 space-y-4 dash-reveal dash-d3" style={{ background: "#0D1829", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-2">
          <Star size={14} style={{ color: "#FBBC04" }} fill="#FBBC04" strokeWidth={0} />
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#5A7898" }}>Tautan</p>
        </div>
        <Field label="URL Ulasan Google Maps" hint="Tombol 'Beri Ulasan' akan muncul di halaman menu jika diisi">
          <input name="google_maps_review_url" value={reviewUrl} onChange={(e) => setReviewUrl(e.target.value)} className={inputCls} style={inputStyle} placeholder="https://g.page/r/…/review" />
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

      {/* Live preview — cafe home screen */}
      <PhoneMockup>
        {/* Cover */}
        <div className="relative w-full" style={{ height: 150 }}>
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover transition-all duration-300" />
          ) : (
            <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #0A3A78, #022C60 55%, #002355)" }} />
          )}
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,23,55,0) 40%, rgba(0,23,55,0.55) 100%)" }} />
          <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wide text-white" style={{ background: "rgba(2,44,96,0.55)", border: "1px solid rgba(255,255,255,0.18)" }}>
            MENU 3D · AR
          </span>
        </div>

        {/* Logo floating over cover edge */}
        <div className="px-4" style={{ marginTop: -28 }}>
          <span className="relative z-10 w-16 h-16 rounded-2xl overflow-hidden inline-flex items-center justify-center" style={{ background: "#FDFDFD", boxShadow: "0 10px 28px rgba(0,0,0,0.45)" }}>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <Image src="/brand/logo-3diner-mark.svg" alt="" width={30} height={30} className="object-contain" />
            )}
          </span>
        </div>

        {/* Greeting + name + address */}
        <div className="px-4 pt-3 pb-4">
          {greeting && (
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] mb-1" style={{ color: "#7B95B6" }}>{greeting}</p>
          )}
          <h3 className="font-display text-[21px] font-extrabold leading-tight text-white transition-all duration-300">{nama || "Nama Kafe"}</h3>
          {alamat && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <MapPin size={12} style={{ color: "#7B95B6" }} />
              <p className="text-[11px]" style={{ color: "#A9BBD4" }}>{alamat}</p>
            </div>
          )}

          {reviewUrl && (
            <div className="flex items-center gap-2 mt-3.5 px-3 py-2.5 rounded-xl" style={{ background: "#FFFFFF" }}>
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full shrink-0" style={{ background: "#F6F8FB" }}>
                <Star size={14} fill="#FBBC04" strokeWidth={0} />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold leading-tight" style={{ color: "#1A1A1A" }}>Beri Ulasan di Google</p>
                <p className="text-[9px] leading-tight" style={{ color: "#5F6368" }}>Dukung kafe ini dengan rating</p>
              </div>
            </div>
          )}
        </div>

        {/* faux category chips + menu grid for context */}
        <div className="px-4 pb-5" style={{ background: "#F6F8FB" }}>
          <div className="flex gap-2 pt-3 pb-3">
            {["Semua", "Menu", "Minuman"].map((c, i) => (
              <span key={c} className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wide" style={{ background: i === 0 ? "#022C60" : "#E0E7EE", color: i === 0 ? "#FFFFFF" : "#5A7898" }}>
                {c}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-xl overflow-hidden" style={{ background: "#FDFDFD", border: "1px solid #CFD9E4" }}>
                <div className="h-16" style={{ background: "#E0E7EE" }} />
                <div className="p-2 space-y-1.5">
                  <div className="h-1.5 rounded-full" style={{ background: "#CFD9E4", width: i % 2 ? "70%" : "85%" }} />
                  <div className="h-1.5 w-10 rounded-full" style={{ background: "#FDE8DC" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </PhoneMockup>
    </div>
  );
}
