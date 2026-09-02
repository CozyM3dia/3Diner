"use client";

import { useState } from "react";
import { XIcon } from "lucide-react";
import MenuEditorForm, { type MenuFormValues } from "@/components/dp/MenuEditorForm";

/** Harness drawer editor menu — memeriksa tata letak tiga tab dan pratinjau
 *  telepon tanpa sesi login dan tanpa data kafe sungguhan. Hanya hidup di
 *  `next dev`; gerbangnya ada di `app/dev-preview/layout.tsx`. */

const AWAL: Partial<MenuFormValues> & { image_url?: string | null } = {
  nama_menu: "Butter Croissant",
  deskripsi: "Croissant berlapis mentega, dipanggang fresh setiap pagi.",
  category: "Pastry",
  harga_menu: 25000,
  discount_pct: 15,
  serve_time_minutes: 8,
  calories: 320,
  ingredients: "Tepung, Mentega, Ragi, Garam",
  is_active: true,
  schedule_days: "",
  schedule_start: "",
  schedule_end: "",
  redirect_link: "",
  model_3d_url: "",
  model_scale: 1,
  image_url: null,
};

export default function HarnessMenuEditor() {
  const [open, setOpen] = useState(true);

  return (
    <main style={{ minHeight: "100vh", background: "var(--dp-bg)", padding: 24 }}>
      <p className="dp-menuf-hint">Harness · fixture, bukan data nyata</p>
      {!open && (
        <button type="button" className="dp-menuf-save" onClick={() => setOpen(true)}>
          Buka drawer editor
        </button>
      )}

      {open && (
        <div className="dp-mdrawer-root" role="dialog" aria-modal="true" aria-label="Edit Menu">
          <div className="dp-mdrawer-backdrop" onClick={() => setOpen(false)} />
          <aside className="dp-mdrawer">
            <header className="dp-mdrawer-head">
              <div>
                <h2 className="dp-mdrawer-title">Edit Menu</h2>
                <p className="dp-mdrawer-sub">Perubahan langsung tayang di menu tamu &amp; kasir.</p>
              </div>
              <button type="button" className="dp-mdrawer-x" aria-label="Tutup" onClick={() => setOpen(false)}>
                <XIcon className="h-4 w-4" />
              </button>
            </header>
            <div className="dp-mdrawer-body">
              <MenuEditorForm
                mode="edit"
                initial={AWAL}
                categories={["Pastry", "Kopi", "Main Course"]}
                onSubmit={() => setOpen(false)}
                onCancel={() => setOpen(false)}
              />
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
