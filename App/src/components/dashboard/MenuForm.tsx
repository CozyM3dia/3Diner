"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, Save, AlertCircle, Clock, Flame, ScanLine, ShoppingBag, ImageOff } from "lucide-react";
import type { Menu } from "@/types";
import type { ActionResult } from "@/lib/dashboard-actions";
import { formatRupiah } from "@/lib/format";
import FileUpload from "./FileUpload";
import PhoneMockup from "./PhoneMockup";

interface MenuFormProps {
  menu?: Menu;
  onSave: (fd: FormData) => Promise<ActionResult>;
  onDelete?: () => Promise<ActionResult>;
}

const WEEKDAYS = [
  { v: "1", l: "Sen" },
  { v: "2", l: "Sel" },
  { v: "3", l: "Rab" },
  { v: "4", l: "Kam" },
  { v: "5", l: "Jum" },
  { v: "6", l: "Sab" },
  { v: "7", l: "Min" },
];

const inputStyle: React.CSSProperties = {
  background: "#132136",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#E9EEF6",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#5A7898" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

export default function MenuForm({ menu, onSave, onDelete }: MenuFormProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [days, setDays] = useState<Set<string>>(
    new Set((menu?.schedule_days ?? "").split(",").map((s) => s.trim()).filter(Boolean))
  );
  const [active, setActive] = useState(menu?.is_active !== false);
  const [modelScale, setModelScale] = useState(menu?.model_scale ?? 1.0);

  // Controlled fields that drive the live preview.
  const [nama, setNama] = useState(menu?.nama_menu ?? "");
  const [harga, setHarga] = useState<number>(menu?.harga_menu ?? 0);
  const [category, setCategory] = useState(menu?.category ?? "");
  const [description, setDescription] = useState(menu?.description_menu ?? "");
  const [prepTime, setPrepTime] = useState<string>(menu?.prep_time_minutes != null ? String(menu.prep_time_minutes) : "");
  const [calories, setCalories] = useState<string>(menu?.calories != null ? String(menu.calories) : "");
  const [ingredients, setIngredients] = useState(menu?.ingredients ?? "");
  const [discount, setDiscount] = useState<number>(menu?.discount_pct ?? 0);
  const [imageUrl, setImageUrl] = useState(menu?.image_url ?? "");

  const promo = discount > 0 ? Math.round(harga * (1 - discount / 100)) : harga;
  const ingList = ingredients.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10);

  const inputCls = "dash-input w-full px-3.5 py-2.5 rounded-xl text-sm outline-none";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    fd.set("schedule_days", [...days].join(","));
    fd.set("is_active", active ? "true" : "false");
    const res = await onSave(fd);
    if (res.error) {
      setError(res.error);
      setSaving(false);
      return;
    }
    router.push("/dashboard/menu");
    router.refresh();
  }

  async function handleDelete() {
    if (!onDelete) return;
    if (!confirm(`Hapus menu "${menu?.nama_menu}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    setDeleting(true);
    const res = await onDelete();
    if (res.error) {
      setError(res.error);
      setDeleting(false);
      return;
    }
    router.push("/dashboard/menu");
    router.refresh();
  }

  function toggleDay(v: string) {
    setDays((prev) => {
      const next = new Set(prev);
      next.has(v) ? next.delete(v) : next.add(v);
      return next;
    });
  }

  return (
    <div className="flex flex-col-reverse gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_350px] lg:gap-10 lg:items-start">
      <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.1)", color: "#FCA5A5" }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Basics */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: "#0D1829", border: "1px solid rgba(255,255,255,0.07)" }}>
        <Field label="Nama Menu *">
          <input name="nama_menu" value={nama} onChange={(e) => setNama(e.target.value)} required className={inputCls} style={inputStyle} placeholder="Pasta Meatball" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Harga (Rp) *">
            <input name="harga_menu" type="number" min="0" value={harga || ""} onChange={(e) => setHarga(Number(e.target.value) || 0)} required className={inputCls} style={inputStyle} placeholder="45000" />
          </Field>
          <Field label="Kategori">
            <input name="category" value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls} style={inputStyle} placeholder="Main Course" />
          </Field>
        </div>
        <Field label="Deskripsi">
          <textarea name="description_menu" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputCls} style={inputStyle} placeholder="Deskripsi singkat hidangan…" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Waktu Saji (menit)">
            <input name="prep_time_minutes" type="number" min="0" value={prepTime} onChange={(e) => setPrepTime(e.target.value)} className={inputCls} style={inputStyle} placeholder="15" />
          </Field>
          <Field label="Kalori">
            <input name="calories" type="number" min="0" value={calories} onChange={(e) => setCalories(e.target.value)} className={inputCls} style={inputStyle} placeholder="650" />
          </Field>
        </div>
        <Field label="Bahan (pisahkan dengan koma)">
          <input name="ingredients" value={ingredients} onChange={(e) => setIngredients(e.target.value)} className={inputCls} style={inputStyle} placeholder="Pasta, Daging Sapi, Saus Tomat" />
        </Field>
      </div>

      {/* Media */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: "#0D1829", border: "1px solid rgba(255,255,255,0.07)" }}>
        <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#5A7898" }}>Media & 3D</p>
        <FileUpload
          name="image_url"
          kind="image"
          label="Foto Menu"
          variant="image"
          accept="image/png,image/jpeg,image/webp,image/avif"
          hint="JPG, PNG, atau WebP · maks 30MB"
          defaultUrl={menu?.image_url}
          onChange={setImageUrl}
        />
        <FileUpload
          name="model_3d_url"
          kind="glb"
          label="Model 3D (.glb)"
          accept=".glb,model/gltf-binary,application/octet-stream"
          hint="File .glb untuk tampilan 3D & AR Android · maks 30MB"
          defaultUrl={menu?.model_3d_url}
        />
        <FileUpload
          name="usdz_url"
          kind="usdz"
          label="Model iOS (.usdz)"
          accept=".usdz,model/vnd.usdz+zip"
          hint="File .usdz untuk AR di iPhone · maks 30MB"
          defaultUrl={menu?.usdz_url}
        />
        <Field label="Skala Default Model 3D">
          <div className="flex items-center gap-4 mt-1">
            <input
              name="model_scale"
              type="range"
              min="0.2"
              max="3.0"
              step="0.1"
              value={modelScale}
              onChange={(e) => setModelScale(parseFloat(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-[#FD5002]"
              style={{ background: "#132136" }}
            />
            <span className="text-sm font-semibold tabular-nums min-w-[42px] text-center" style={{ color: "#E9EEF6" }}>
              {modelScale.toFixed(1)}x
            </span>
          </div>
          <p className="text-[11px] mt-1.5" style={{ color: "#5A7898" }}>
            Ukuran dasar model 3D saat pertama dimuat di 3D & AR. Pelanggan tetap bisa cubit untuk zoom.
          </p>
        </Field>
        <Field label="Link Pesan (opsional)">
          <input name="redirect_link" defaultValue={menu?.redirect_link ?? ""} className={inputCls} style={inputStyle} placeholder="https://…" />
        </Field>
      </div>

      {/* Availability */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: "#0D1829", border: "1px solid rgba(255,255,255,0.07)" }}>
        <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#5A7898" }}>Ketersediaan</p>

        <button
          type="button"
          onClick={() => setActive((a) => !a)}
          className="flex items-center justify-between w-full"
        >
          <span className="text-sm" style={{ color: "#E9EEF6" }}>Tampilkan di menu</span>
          <span className="relative inline-block w-11 h-6 rounded-full" style={{ background: active ? "#FD5002" : "rgba(255,255,255,0.12)", transition: "background 150ms ease-out" }}>
            <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white" style={{ left: active ? "22px" : "2px", transition: "left 180ms cubic-bezier(0.22,1,0.36,1)" }} />
          </span>
        </button>

        <Field label="Diskon (%)">
          <input name="discount_pct" type="number" min="0" max="100" value={discount || ""} onChange={(e) => setDiscount(Number(e.target.value) || 0)} className={inputCls} style={inputStyle} />
        </Field>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#5A7898" }}>Hari Tersedia</label>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d) => {
              const on = days.has(d.v);
              return (
                <button
                  key={d.v}
                  type="button"
                  onClick={() => toggleDay(d.v)}
                  className="dash-chip px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{
                    background: on ? "rgba(253,80,2,0.14)" : "#132136",
                    color: on ? "#FD5002" : "#5A7898",
                    border: `1px solid ${on ? "rgba(253,80,2,0.4)" : "rgba(255,255,255,0.08)"}`,
                    transition: "all 150ms ease-out",
                  }}
                >
                  {d.l}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] mt-1.5" style={{ color: "#5A7898" }}>Kosongkan = tersedia setiap hari</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Jam Mulai">
            <input name="schedule_start" type="time" defaultValue={menu?.schedule_start ?? ""} className={inputCls} style={inputStyle} />
          </Field>
          <Field label="Jam Selesai">
            <input name="schedule_end" type="time" defaultValue={menu?.schedule_end ?? ""} className={inputCls} style={inputStyle} />
          </Field>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="dash-btn inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: "#FD5002", opacity: saving ? 0.7 : 1 }}
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {menu ? "Simpan Perubahan" : "Tambah Menu"}
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="dash-press inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
            style={{ background: "rgba(239,68,68,0.1)", color: "#FCA5A5" }}
          >
            {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
            Hapus
          </button>
        )}
      </div>
      </form>

      {/* Live preview — dish detail as the customer sees it */}
      <PhoneMockup>
        {/* Dish image */}
        <div className="relative w-full" style={{ height: 188, background: "#0A1F40" }}>
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="w-full h-full object-cover transition-all duration-300" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2" style={{ color: "#3B557C" }}>
              <ImageOff size={26} strokeWidth={1.4} />
              <span className="text-[11px] font-medium">Belum ada gambar</span>
            </div>
          )}
          {discount > 0 && (
            <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg text-[11px] font-bold text-white" style={{ background: "#FD5002" }}>
              -{discount}%
            </span>
          )}
        </div>

        <div className="px-4 pt-4 pb-5">
          {category && (
            <span className="inline-block mb-2 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{ background: "rgba(253,80,2,0.14)", color: "#FF7A3D" }}>
              {category}
            </span>
          )}
          <h3 className="font-display text-[19px] font-extrabold leading-tight text-white transition-all duration-300">
            {nama || "Nama Hidangan"}
          </h3>

          {/* Meta: prep time + calories */}
          {(prepTime || calories) && (
            <div className="flex items-center gap-3 mt-2.5">
              {prepTime && (
                <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: "#9FB6D1" }}>
                  <Clock size={12} /> {prepTime} mnt
                </span>
              )}
              {calories && (
                <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: "#9FB6D1" }}>
                  <Flame size={12} /> {calories} kkal
                </span>
              )}
            </div>
          )}

          {/* Price */}
          <div className="flex items-baseline gap-2 mt-3">
            <span className="text-[20px] font-extrabold tabular-nums" style={{ color: "#FD5002" }}>
              {formatRupiah(promo || 0)}
            </span>
            {discount > 0 && harga > 0 && (
              <span className="text-[13px] line-through tabular-nums" style={{ color: "#5A7898" }}>
                {formatRupiah(harga)}
              </span>
            )}
          </div>

          {description && (
            <p className="text-[12px] leading-relaxed mt-3" style={{ color: "#A9BBD4" }}>
              {description}
            </p>
          )}

          {ingList.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {ingList.map((ing, i) => (
                <span key={i} className="px-2 py-0.5 rounded-md text-[10px] font-medium" style={{ background: "rgba(255,255,255,0.06)", color: "#9FB6D1" }}>
                  {ing}
                </span>
              ))}
            </div>
          )}

          {/* CTAs */}
          <button type="button" tabIndex={-1} className="w-full mt-4 h-11 rounded-xl flex items-center justify-center gap-2 text-[13px] font-bold text-white" style={{ background: "#FD5002", boxShadow: "0 6px 20px rgba(253,80,2,0.28)" }}>
            <ScanLine size={16} /> Mulai AR (Tampilan 3D)
          </button>
          <button type="button" tabIndex={-1} className="w-full mt-2 h-11 rounded-xl flex items-center justify-center gap-2 text-[13px] font-semibold" style={{ background: "transparent", border: "1.5px solid rgba(255,255,255,0.18)", color: "#E9EEF6" }}>
            <ShoppingBag size={15} /> Tambah ke Keranjang
          </button>
        </div>
      </PhoneMockup>
    </div>
  );
}
