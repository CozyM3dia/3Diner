"use client";

import { useState } from "react";
import { Loader2, Save, Check, AlertCircle, Megaphone } from "lucide-react";
import { saveAnnouncement } from "@/lib/dashboard-actions";
import type { Announcement } from "@/types";

const PRESETS = [
  { name: "Oranye", value: "#FD5002" },
  { name: "Navy", value: "#022C60" },
  { name: "Teal", value: "#0F766E" },
  { name: "Merah", value: "#B91C1C" },
  { name: "Hitam", value: "#111827" },
];

export default function AnnouncementForm({ announcement }: { announcement: Announcement | null }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState(announcement?.message ?? "");
  const [color, setColor] = useState(announcement?.bg_color ?? "#FD5002");
  const [active, setActive] = useState(announcement?.is_active ?? false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaved(false);
    setSaving(true);
    const fd = new FormData();
    if (announcement?.id) fd.set("id", announcement.id);
    fd.set("message", message);
    fd.set("bg_color", color);
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.1)", color: "#FCA5A5" }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Live preview */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#5A7898" }}>Pratinjau</p>
        <div
          className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium"
          style={{ background: color, color: "#FFFFFF" }}
        >
          <Megaphone size={16} className="shrink-0" />
          <span className="truncate">{message || "Pesan pengumuman akan tampil di sini"}</span>
        </div>
      </div>

      <div className="rounded-2xl p-5 space-y-5" style={{ background: "#0D1829", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#5A7898" }}>
            Pesan
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            maxLength={120}
            className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: "#132136", border: "1px solid rgba(255,255,255,0.1)", color: "#E9EEF6" }}
            placeholder="Live music malam ini mulai jam 19.00!"
          />
          <p className="text-[11px] mt-1" style={{ color: "#5A7898" }}>{message.length}/120</p>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#5A7898" }}>
            Warna Latar
          </label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setColor(p.value)}
                className="w-9 h-9 rounded-xl"
                style={{
                  background: p.value,
                  outline: color === p.value ? "2px solid #E9EEF6" : "1px solid rgba(255,255,255,0.1)",
                  outlineOffset: "2px",
                }}
                aria-label={p.name}
              />
            ))}
          </div>
        </div>

        <button type="button" onClick={() => setActive((a) => !a)} className="flex items-center justify-between w-full">
          <div className="text-left">
            <span className="text-sm block" style={{ color: "#E9EEF6" }}>Aktifkan pengumuman</span>
            <span className="text-[11px]" style={{ color: "#5A7898" }}>Tampilkan banner di halaman menu pelanggan</span>
          </div>
          <span className="relative inline-block w-11 h-6 rounded-full shrink-0" style={{ background: active ? "#22D3A6" : "rgba(255,255,255,0.12)", transition: "background 150ms ease-out" }}>
            <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white" style={{ left: active ? "22px" : "2px", transition: "left 180ms cubic-bezier(0.22,1,0.36,1)" }} />
          </span>
        </button>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
        style={{ background: saved ? "#22D3A6" : "#FD5002", opacity: saving ? 0.7 : 1, transition: "background 200ms ease-out" }}
      >
        {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <Check size={15} /> : <Save size={15} />}
        {saved ? "Tersimpan" : "Simpan Pengumuman"}
      </button>
    </form>
  );
}
