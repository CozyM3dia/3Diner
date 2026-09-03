"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { EllipsisVerticalIcon, ImageOffIcon, PencilLineIcon, PlusIcon, SearchIcon } from "lucide-react";
import { useMenuEdit } from "@/components/dp/MenuEditorHost";

/** Grid Items ala Dream POS `items.html`: header (judul + search + Add New),
 *  kartu produk 4 kolom (foto, nama, harga, penanda titik status), pager.
 *
 *  Template memakai penanda titik Veg/Non Veg; di sini titik itu memuat data
 *  yang benar-benar kita punya: menu tayang (`is_active`) atau tidak.
 *  Kebab menu template berisi Edit/Delete/Hide — hanya Edit yang punya
 *  implementasi nyata (editor menu existing), jadi hanya Edit yang ditampilkan. */

export type GridItem = {
  id_menu: string;
  nama_menu: string;
  harga_menu: number | null;
  image_url: string | null;
  category: string | null;
  is_active: boolean;
};

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

const PAGE_SIZE = 12;

export default function ItemsGrid({
  items,
  initialQuery = "",
}: {
  items: GridItem[];
  /** Terisi saat datang dari kartu kategori (`/dashboard-v2/items?q=Pastry`). */
  initialQuery?: string;
}) {
  const [q, setQ] = useState(initialQuery);
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const { openCreate, openEdit } = useMenuEdit();

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      it =>
        it.nama_menu.toLowerCase().includes(needle) ||
        (it.category ?? "").toLowerCase().includes(needle),
    );
  }, [items, q]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const slice = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <>
      <div className="dp-page-head">
        <h1>Items</h1>
        <div className="dp-page-head-tools">
          <label className="dp-field">
            <input
              name="item-search"
              value={q}
              onChange={e => {
                setQ(e.target.value);
                setPage(0);
              }}
              placeholder="Cari menu"
              aria-label="Cari menu"
            />
            <SearchIcon className="h-4 w-4" />
          </label>
          <button type="button" className="dp-add-btn" onClick={openCreate}>
            <PlusIcon className="h-4 w-4" /> Add New
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="dp-card dp-empty">
          {items.length === 0
            ? "Belum ada menu di kafe ini."
            : `Tidak ada menu yang cocok dengan “${q.trim()}”.`}
        </div>
      ) : (
        <div className="dp-items-grid">
          {slice.map(it => (
            <article key={it.id_menu} className="dp-card dp-food">
              <div className="dp-food-media">
                {it.image_url ? (
                  <Image
                    src={it.image_url}
                    alt={it.nama_menu}
                    width={320}
                    height={240}
                    sizes="(max-width: 560px) calc(100vw - 72px), (max-width: 900px) calc((100vw - 112px) / 2), (max-width: 1200px) calc((100vw - 360px) / 3), 280px"
                    className="dp-food-img"
                  />
                ) : (
                  <span className="dp-food-img dp-food-img-empty">
                    <ImageOffIcon className="h-5 w-5" />
                  </span>
                )}
                <button
                  type="button"
                  className="dp-food-menu"
                  aria-label={`Aksi untuk ${it.nama_menu}`}
                  aria-expanded={openId === it.id_menu}
                  onClick={() => setOpenId(openId === it.id_menu ? null : it.id_menu)}
                >
                  <EllipsisVerticalIcon className="h-4 w-4" />
                </button>
                {openId === it.id_menu && (
                  <div className="dp-food-drop">
                    <button type="button" className="dp-food-drop-item" onClick={() => openEdit(it.id_menu)}>
                      <PencilLineIcon className="h-4 w-4" />
                      Edit Item
                    </button>
                  </div>
                )}
              </div>
              <h2 className="dp-food-name">
                <button type="button" className="dp-food-name-btn" onClick={() => openEdit(it.id_menu)}>
                  {it.nama_menu}
                </button>
              </h2>
              <div className="dp-food-foot">
                <span className="dp-food-price">{rupiah(it.harga_menu ?? 0)}</span>
                <span className={`dp-food-flag${it.is_active ? "" : " dp-food-flag-off"}`}>
                  <i />
                  {it.is_active ? "Live" : "Offline"}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}

      {pages > 1 && (
        <nav className="dp-pager" aria-label="Halaman menu">
          <button type="button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
            Pre
          </button>
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              type="button"
              className={i === safePage ? "dp-pager-on" : undefined}
              aria-current={i === safePage ? "page" : undefined}
              onClick={() => setPage(i)}
            >
              {i + 1}
            </button>
          ))}
          <button
            type="button"
            disabled={safePage >= pages - 1}
            onClick={() => setPage(safePage + 1)}
          >
            Next
          </button>
        </nav>
      )}
    </>
  );
}
