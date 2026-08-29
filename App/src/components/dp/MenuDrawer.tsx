"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, XIcon } from "lucide-react";
import MenuEditorForm, {
  type MenuFormValues,
} from "@/components/dp/MenuEditorForm";
import { getMenuEditorData, upsertMenuFromEditor } from "@/lib/menu-admin-actions";

/** Panel editor menu MENGAMBANG (floating right drawer) di atas halaman Items —
 *  pola modal "Edit Item" Dream POS: grid tetap terlihat di kiri, panel form
 *  di kanan dengan backdrop tipis. Buka via prop `editId` / `create`.
 *  Dipakai MenuEditorHost; komponen ini murni presentasi + logika simpan. */

export type MenuDrawerProps = {
  open: boolean;
  /** null = mode create. */
  editId: string | null;
  /** Kategori untuk datalist (fallback saat edit sebelum data termuat). */
  categories?: string[];
  onClose: () => void;
  /** Dipanggil setelah simpan sukses (untuk router.refresh). */
  onSaved?: () => void;
};

type Loaded =
  | { state: "loading" }
  | { state: "error"; message: string }
  | {
      state: "ready";
      values: Partial<MenuFormValues>;
      imageUrl: string | null;
      categories: string[];
    };

export default function MenuDrawer({ open, editId, categories = [], onClose, onSaved }: MenuDrawerProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const [, startTransition] = useTransition();
  // Kunci muat: hanya berubah saat panel dibuka / target edit berganti.
  const loadKey = open ? editId ?? "create" : null;
  const [lastLoadKey, setLastLoadKey] = useState<string | null>(null);

  // Muat data menu tiap kali panel dibuka untuk EDIT (adjust-during-render,
  // bukan effect-setState).
  if (open && loadKey !== lastLoadKey) {
    setLastLoadKey(loadKey);
    setServerError(null);
    if (!editId) {
      setLoaded({ state: "ready", values: {}, imageUrl: null, categories });
    } else {
      setLoaded({ state: "loading" });
      void (async () => {
        const res = await getMenuEditorData(editId);
        if (res.error) {
          setLoaded({ state: "error", message: res.error });
          return;
        }
        setLoaded({
          state: "ready",
          values: res.values ?? {},
          imageUrl: res.imageUrl ?? null,
          categories: res.categories?.length ? res.categories : categories,
        });
      })();
    }
  }

  // Escape menutup panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function handleSave(values: MenuFormValues, photo: File | null) {
    if (busy) return;
    setBusy(true);
    setServerError(null);
    void (async () => {
      try {
        const res = await upsertMenuFromEditor({ id_menu: editId ?? undefined, values, photo });
        if (res.error) {
          setServerError(res.error);
          return;
        }
        setSavedAt(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));
        onSaved?.();
        startTransition(() => router.refresh());
        onClose();
      } catch {
        setServerError("Terjadi kesalahan. Coba lagi.");
      } finally {
        setBusy(false);
      }
    })();
  }

  return (
    <div className="dp-mdrawer-root" role="dialog" aria-modal="true" aria-label={editId ? "Edit Menu" : "Tambah Menu"}>
      <div className="dp-mdrawer-backdrop" onClick={onClose} />
      <aside className="dp-mdrawer">
        <header className="dp-mdrawer-head">
          <div>
            <h2 className="dp-mdrawer-title">{editId ? "Edit Menu" : "Tambah Menu"}</h2>
            <p className="dp-mdrawer-sub">
              {editId ? "Perubahan langsung tayang di menu tamu & kasir." : "Menu baru masuk ke katalog Menu Management."}
            </p>
          </div>
          <button type="button" className="dp-mdrawer-x" aria-label="Tutup" onClick={onClose}>
            <XIcon className="h-4 w-4" />
          </button>
        </header>

        <div className="dp-mdrawer-body">
          {loaded.state === "loading" && (
            <p className="dp-mdrawer-status">
              <Loader2Icon className="h-4 w-4 animate-spin" /> Memuat menu…
            </p>
          )}
          {loaded.state === "error" && <p className="dp-menuf-err">{loaded.message}</p>}
          {loaded.state === "ready" && (
            <MenuEditorForm
              mode={editId ? "edit" : "create"}
              initial={loaded.values}
              categories={loaded.categories}
              busy={busy}
              lastSavedAt={savedAt}
              serverError={serverError}
              onSubmit={handleSave}
              onCancel={onClose}
            />
          )}
        </div>
      </aside>
    </div>
  );
}
