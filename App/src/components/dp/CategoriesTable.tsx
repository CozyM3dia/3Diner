"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDownIcon, ImageOffIcon, ListFilterIcon, SearchIcon } from "lucide-react";

/** Tabel Categories ala Dream POS `categories.html`: kartu berisi toolbar
 *  (search kiri, kontrol kanan) + tabel Category / No of Items / Created On /
 *  Status / Actions.
 *
 *  Kafe ini tidak punya tabel Categories — kategori adalah teks bebas di
 *  `Menus.category`. Jadi tiap kolom diisi agregasi nyata:
 *  thumbnail = foto item pertama, jumlah item, tanggal menu terlama di
 *  kategori itu, status = ada item tayang atau tidak. Karena tak ada entitas
 *  kategori yang bisa diubah/dihapus, kolom Actions hanya berisi satu tautan
 *  nyata: buka daftar Items yang tersaring ke kategori tersebut. */

export type CategoryRow = {
  name: string;
  items: number;
  liveItems: number;
  firstCreatedAt: string;
  thumb: string | null;
};

const SORTS = [
  { key: "newest", label: "Terbaru" },
  { key: "oldest", label: "Terlama" },
  { key: "az", label: "A–Z" },
  { key: "za", label: "Z–A" },
] as const;

type SortKey = (typeof SORTS)[number]["key"];

const tanggal = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

export default function CategoriesTable({ rows }: { rows: CategoryRow[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [sortOpen, setSortOpen] = useState(false);

  const view = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = needle ? rows.filter(r => r.name.toLowerCase().includes(needle)) : rows;
    const sorted = [...base];
    sorted.sort((a, b) => {
      switch (sort) {
        case "oldest":
          return a.firstCreatedAt.localeCompare(b.firstCreatedAt);
        case "az":
          return a.name.localeCompare(b.name, "id");
        case "za":
          return b.name.localeCompare(a.name, "id");
        default:
          return b.firstCreatedAt.localeCompare(a.firstCreatedAt);
      }
    });
    return sorted;
  }, [rows, q, sort]);

  return (
    <>
      <div className="dp-page-head">
        <h1>Categories</h1>
      </div>

      <div className="dp-card">
        <div className="dp-card-body">
          <div className="dp-table-tools">
            <label className="dp-field">
              <SearchIcon className="h-4 w-4" />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Cari kategori"
                aria-label="Cari kategori"
              />
            </label>

            <div className="dp-drop-wrap">
              <button
                type="button"
                className="dp-btn-white"
                aria-expanded={sortOpen}
                onClick={() => setSortOpen(!sortOpen)}
              >
                <ListFilterIcon className="h-4 w-4" />
                Urut: {SORTS.find(s => s.key === sort)?.label}
                <ChevronDownIcon className="h-4 w-4" />
              </button>
              {sortOpen && (
                <div className="dp-drop">
                  {SORTS.map(s => (
                    <button
                      key={s.key}
                      type="button"
                      className={`dp-drop-item${s.key === sort ? " dp-drop-item-on" : ""}`}
                      onClick={() => {
                        setSort(s.key);
                        setSortOpen(false);
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="dp-table-wrap">
            <table className="dp-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Jumlah Item</th>
                  <th>Menu Pertama</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {view.map(r => (
                  <tr key={r.name}>
                    <td>
                      <span className="dp-cell-cat">
                        <span className="dp-avatar-sm">
                          {r.thumb ? (
                            <Image src={r.thumb} alt="" width={32} height={32} />
                          ) : (
                            <ImageOffIcon className="h-4 w-4" />
                          )}
                        </span>
                        {r.name}
                      </span>
                    </td>
                    <td>{r.items}</td>
                    <td>{tanggal(r.firstCreatedAt)}</td>
                    <td>
                      {r.liveItems > 0 ? (
                        <span className="dp-badge dp-badge-success">
                          {r.liveItems === r.items ? "Semua tayang" : `${r.liveItems} dari ${r.items} tayang`}
                        </span>
                      ) : (
                        <span className="dp-badge dp-badge-danger">Tidak ada yang tayang</span>
                      )}
                    </td>
                    <td>
                      <Link
                        href={`/dashboard-v2/items?q=${encodeURIComponent(r.name)}`}
                        className="dp-btn-white dp-btn-link"
                      >
                        Lihat item
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {view.length === 0 && (
            <p className="dp-empty">
              {rows.length === 0
                ? "Belum ada menu, jadi belum ada kategori."
                : `Tidak ada kategori yang cocok dengan “${q.trim()}”.`}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
