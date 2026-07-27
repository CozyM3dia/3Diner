"use client";

import { useState } from "react";
import { Loader2, Save, Check, AlertCircle, Plus, EyeOff, X } from "lucide-react";
import { saveAnnouncement } from "@/lib/dashboard-actions";
import { ANNOUNCEMENT_TYPES, typeMeta, type AnnouncementType } from "@/lib/announcement-types";
import { readableOn, readableSoftOn } from "@/lib/contrast";
import { DashboardPanel, Field, dashInputStyle } from "@/components/dashboard/system";
import PhoneMockup from "./PhoneMockup";
import type { Announcement } from "@/types";

const PRESETS = [
  { name: "Oranye", value: "#FD5002" },
  { name: "Navy", value: "#022C60" },
  { name: "Teal", value: "#0F766E" },
  { name: "Merah", value: "#B91C1C" },
  { name: "Ungu", value: "#6D28D9" },
];

interface Template {
  label: string;
  type: AnnouncementType;
  message: string;
  color: string;
}

const TEMPLATES: Template[] = [
  { label: "Live Music", type: "event", message: "Live music malam ini mulai jam 19.00. Sampai ketemu!", color: "#0F766E" },
  { label: "Promo Hari Ini", type: "promo", message: "Promo spesial hari ini: beli 2 kopi gratis 1.", color: "#FD5002" },
  { label: "Jam Buka", type: "info", message: "Buka setiap hari jam 10.00 sampai 22.00.", color: "#022C60" },
  { label: "Menu Baru", type: "promo", message: "Menu baru sudah tersedia. Cek koleksi terbaru kami.", color: "#FD5002" },
  { label: "Libur", type: "warning", message: "Tutup sementara tanggal 17. Mohon maaf atas ketidaknyamanannya.", color: "#B91C1C" },
];

const MAX = 120;

export default function AnnouncementForm({ announcement }: { announcement: Announcement | null }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState(announcement?.message ?? "");
  const [color, setColor] = useState(announcement?.bg_color ?? "#FD5002");
  const [type, setType] = useState<AnnouncementType>(announcement?.type ?? "info");
  const [active, setActive] = useState(announcement?.is_active ?? false);

  const meta = typeMeta(type);
  const PreviewIcon = meta.icon;
  const fg = readableOn(color);
  const soft = readableSoftOn(color);
  const near = MAX - message.length;

  function applyTemplate(t: Template) {
    setMessage(t.message);
    setType(t.type);
    setColor(t.color);
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaved(false);
    setSaving(true);
    const fd = new FormData();
    if (announcement?.id) fd.set("id", announcement.id);
    fd.set("message", message);
    fd.set("bg_color", color);
    fd.set("type", type);
    fd.set("is_active", active ? "true" : "false");
    const res = await saveAnnouncement(fd);
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col-reverse gap-7 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-9 lg:items-start"
    >
      {/* ── Editor ─────────────────────────────────────────────── */}
      <DashboardPanel title="Editor Banner" bodyClassName="dash-panel-body space-y-7">
        {error && (
          <div
            className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
            style={{ background: "rgba(239,68,68,0.1)", color: "#FCA5A5" }}
          >
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Type */}
        <Field label="Jenis">
          <div className="grid grid-cols-4 gap-2">
            {ANNOUNCEMENT_TYPES.map((t) => {
              const Icon = t.icon;
              const on = type === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className="dash-press flex flex-col items-center gap-1.5 py-3 rounded-xl"
                  style={{
                    background: on ? "rgba(253,80,2,0.1)" : "#0D1829",
                    border: `1px solid ${on ? "rgba(253,80,2,0.55)" : "rgba(255,255,255,0.07)"}`,
                    transition: "background 150ms ease-out, border-color 150ms ease-out",
                  }}
                >
                  <Icon size={17} style={{ color: on ? "#FD5002" : "#7B95B6" }} />
                  <span className="text-[11px] font-medium" style={{ color: on ? "#E9EEF6" : "var(--dash-muted)" }}>
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>
        </Field>

        {/* Templates */}
        <Field label="Template cepat">
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => applyTemplate(t)}
                className="dash-press inline-flex items-center gap-1.5 pl-2.5 pr-3 py-2 rounded-lg text-[12px] font-medium"
                style={{ background: "#0D1829", border: "1px solid rgba(255,255,255,0.08)", color: "#B8C7DC" }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: t.color, boxShadow: `0 0 0 2px ${t.color}33` }}
                />
                {t.label}
              </button>
            ))}
          </div>
        </Field>

        {/* Message */}
        <Field label="Pesan" htmlFor="ann-message">
          <div className="relative">
            <textarea
              id="ann-message"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, MAX))}
              rows={3}
              maxLength={MAX}
              className="dash-input w-full px-3.5 py-3 rounded-xl text-sm outline-none resize-none"
              style={dashInputStyle}
              placeholder="Live music malam ini mulai jam 19.00!"
            />
            <span
              className="absolute bottom-2.5 right-3 text-[11px] tabular-nums font-medium"
              style={{ color: near <= 15 ? "#F0A742" : "var(--dash-muted)" }}
            >
              {message.length}/{MAX}
            </span>
          </div>
        </Field>

        {/* Color */}
        <Field label="Warna latar">
          <div className="flex flex-wrap items-center gap-2.5">
            {PRESETS.map((p) => {
              const on = color.toUpperCase() === p.value.toUpperCase();
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setColor(p.value)}
                  className="dash-press w-9 h-9 rounded-xl relative"
                  style={{
                    background: p.value,
                    outline: on ? "2px solid #E9EEF6" : "1px solid rgba(255,255,255,0.1)",
                    outlineOffset: "2px",
                  }}
                  aria-label={p.name}
                >
                  {on && <Check size={15} className="absolute inset-0 m-auto" style={{ color: readableOn(p.value) }} />}
                </button>
              );
            })}
            {/* Custom color */}
            <label
              className="dash-press w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer relative overflow-hidden"
              style={{ border: "1px dashed rgba(255,255,255,0.22)", background: "#0D1829" }}
              aria-label="Warna kustom"
            >
              <Plus size={15} style={{ color: "#7B95B6" }} />
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </label>
            <span className="text-[12px] tabular-nums ml-0.5" style={{ color: "var(--dash-muted)" }}>
              {color.toUpperCase()}
            </span>
          </div>
        </Field>

        {/* Active toggle */}
        <div
          className="flex items-center justify-between rounded-2xl px-4 py-3.5"
          style={{ background: "#0D1829", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="text-left pr-4">
            <span className="text-sm block font-medium" style={{ color: "#E9EEF6" }}>
              Tampilkan ke pelanggan
            </span>
            <span className="text-[11px]" style={{ color: "var(--dash-muted)" }}>
              {active ? "Banner aktif di halaman menu" : "Banner disembunyikan saat ini"}
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={active}
            onClick={() => setActive((a) => !a)}
            className="relative inline-block w-11 h-6 rounded-full shrink-0"
            style={{ background: active ? "#22D3A6" : "rgba(255,255,255,0.12)", transition: "background 150ms ease-out" }}
          >
            <span
              className="absolute top-0.5 w-5 h-5 rounded-full bg-white"
              style={{ left: active ? "22px" : "2px", transition: "left 180ms cubic-bezier(0.22,1,0.36,1)" }}
            />
          </button>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="dash-btn inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold dash-on-accent"
          style={{
            background: saved ? "#22D3A6" : "#FD5002",
            opacity: saving ? 0.7 : 1,
            transition: "background 200ms ease-out, filter 0.15s, transform 0.12s",
          }}
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <Check size={15} /> : <Save size={15} />}
          {saved ? "Tersimpan" : "Simpan Pengumuman"}
        </button>
      </DashboardPanel>

      {/* ── Live preview ───────────────────────────────────────── */}
      <PhoneMockup>
        {/* faux cafe cover */}
        <div className="relative h-[84px]" style={{ background: "linear-gradient(135deg,#0B2A52,#022C60)" }}>
          <div className="absolute inset-0 grain opacity-40" />
          <div className="absolute bottom-3 left-4">
            <div className="h-2.5 w-24 rounded-full" style={{ background: "rgba(255,255,255,0.9)" }} />
            <div className="h-1.5 w-16 rounded-full mt-1.5" style={{ background: "rgba(255,255,255,0.45)" }} />
          </div>
        </div>

        {/* the real banner, rendered live */}
        {active ? (
          <div
            className="flex items-center gap-2 px-3.5 py-3 text-[12px] font-medium transition-all duration-300"
            style={{ background: color, color: fg }}
          >
            <PreviewIcon size={14} className="shrink-0" style={{ color: fg }} />
            <span className="flex-1 leading-snug line-clamp-2">
              {message || "Pesan pengumuman akan tampil di sini"}
            </span>
            <X size={13} className="shrink-0" style={{ color: soft }} />
          </div>
        ) : (
          <div
            className="flex items-center justify-center gap-1.5 px-3 py-3 text-[11px] font-medium"
            style={{ background: "#E0E7EE", color: "var(--dash-muted)" }}
          >
            <EyeOff size={12} /> Banner nonaktif
          </div>
        )}

        {/* faux menu grid */}
        <div className="grid grid-cols-2 gap-2.5 p-3.5" style={{ background: "#F6F8FB" }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl overflow-hidden" style={{ background: "#FDFDFD", border: "1px solid #CFD9E4" }}>
              <div className="h-14" style={{ background: "#E0E7EE" }} />
              <div className="p-2 space-y-1.5">
                <div className="h-1.5 rounded-full" style={{ background: "#CFD9E4", width: i % 2 ? "70%" : "85%" }} />
                <div className="h-1.5 w-10 rounded-full" style={{ background: "#FDE8DC" }} />
              </div>
            </div>
          ))}
        </div>
      </PhoneMockup>
    </form>
  );
}
