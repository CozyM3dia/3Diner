import { describe, expect, it } from "vitest";
import {
  ADDON_PRESETS,
  addonIssues,
  addonPriceSpan,
  applyRule,
  emptyGroup,
  emptyValue,
  normalizeGroup,
  presetToGroup,
  pruneAddonDrafts,
  ruleOf,
  withKeys,
  type AddonGroupDraft,
} from "@/lib/menu-addon-drafts";
import { optionGroupsValidationError } from "@/lib/menu-option-drafts";

/** Aturan tambahan menu ditegakkan di DUA tempat — formulir (agar pemilik tahu
 *  seketika) dan server (agar penolakan benar-benar mengikat). Berkas ini
 *  menjaga keduanya tetap sepakat, dan menjaga dua hal yang kalau salah akan
 *  MENGHAPUS data pemilik tanpa suara: pemangkasan baris kosong, dan resep
 *  inventory yang menumpang lewat editor ini tanpa disunting. */

function grup(over: Partial<AddonGroupDraft> = {}): AddonGroupDraft {
  return {
    key: "g1",
    name: "Ukuran",
    min_select: 1,
    max_select: 1,
    values: [
      { key: "v1", name: "Reguler", price_delta: 0, is_active: true, recipes: [] },
      { key: "v2", name: "Large", price_delta: 5000, is_active: true, recipes: [] },
    ],
    ...over,
  };
}

/** Draft editor → bentuk yang dikirim ke `replace_menu_options`. Cerminan
 *  `toOptionDrafts` di menu-admin-actions; dipakai untuk membuktikan validator
 *  formulir dan validator server memberi putusan yang sama. */
function keDraftServer(groups: AddonGroupDraft[]) {
  return groups.map(g => ({
    name: g.name.trim(),
    min_select: g.min_select,
    max_select: g.max_select,
    values: g.values.map(v => ({
      name: v.name.trim(),
      price_delta: v.price_delta,
      is_active: v.is_active,
      recipes: v.recipes,
    })),
  }));
}

describe("aturan pilihan (min/max ↔ tiga tombol)", () => {
  it("menerjemahkan pasangan min/max ke aturan yang dimengerti pemilik", () => {
    expect(ruleOf(grup({ min_select: 1, max_select: 1 }))).toBe("wajib");
    expect(ruleOf(grup({ min_select: 0, max_select: 1 }))).toBe("opsional");
    expect(ruleOf(grup({ min_select: 0, max_select: 3 }))).toBe("banyak");
  });

  it("bolak-balik: aturan → min/max → aturan tetap sama", () => {
    for (const rule of ["wajib", "opsional", "banyak"] as const) {
      expect(ruleOf(applyRule(grup(), rule))).toBe(rule);
    }
  });

  it("'pilih banyak' tidak pernah meminta lebih dari jumlah pilihan yang ada", () => {
    const g = applyRule(grup(), "banyak");
    expect(g.max_select).toBeLessThanOrEqual(g.values.length);
  });
});

describe("normalizeGroup", () => {
  it("menjepit max ke jumlah pilihan saat satu pilihan dihapus", () => {
    const g = normalizeGroup(grup({ min_select: 0, max_select: 3, values: grup().values.slice(0, 1) }));
    expect(g.max_select).toBe(1);
  });

  it("menjepit min agar tidak melebihi max", () => {
    const g = normalizeGroup(grup({ min_select: 5, max_select: 2 }));
    expect(g.min_select).toBeLessThanOrEqual(g.max_select);
  });
});

describe("pruneAddonDrafts", () => {
  it("membuang grup yang belum disentuh sama sekali", () => {
    // Sekali klik "Tambah grup" karena penasaran tidak boleh mengunci simpan.
    expect(pruneAddonDrafts([emptyGroup()])).toEqual([]);
  });

  it("membuang baris pilihan kosong tapi mempertahankan grup yang sudah dinamai", () => {
    const hasil = pruneAddonDrafts([emptyGroup("Topping")]);
    expect(hasil).toHaveLength(1);
    expect(hasil[0].values).toEqual([]);
  });

  it("TIDAK membuang pilihan bernilai nol yang sudah dinamai", () => {
    const g = grup({ values: [{ key: "v1", name: "Tanpa Es", price_delta: 0, is_active: true, recipes: [] }] });
    expect(pruneAddonDrafts([g])[0].values).toHaveLength(1);
  });

  it("mempertahankan baris yang punya resep meski namanya belum diisi — resep itu data pemilik", () => {
    const g = grup({
      values: [{ key: "v1", name: "", price_delta: 0, is_active: true, recipes: [{ inventory_item_id: "i1", qty_per_menu: 2 }] }],
    });
    expect(pruneAddonDrafts([g])[0].values).toHaveLength(1);
  });
});

describe("addonIssues", () => {
  it("melewatkan grup yang benar", () => {
    expect(addonIssues([grup()])).toEqual([]);
  });

  it("menolak grup tanpa nama", () => {
    expect(addonIssues([grup({ name: "  " })])).toHaveLength(1);
  });

  it("menolak grup tanpa pilihan", () => {
    const masalah = addonIssues([grup({ values: [] })]);
    expect(masalah.some(m => /belum punya pilihan/i.test(m.message))).toBe(true);
  });

  it("menolak nama pilihan kembar dalam satu grup, dan menunjuk barisnya", () => {
    const g = grup({
      values: [
        { key: "v1", name: "Large", price_delta: 0, is_active: true, recipes: [] },
        { key: "v2", name: "large", price_delta: 0, is_active: true, recipes: [] },
      ],
    });
    const masalah = addonIssues([g]);
    expect(masalah.some(m => m.valueKey === "v2")).toBe(true);
  });

  it("menolak dua grup dengan nama sama pada satu menu", () => {
    const masalah = addonIssues([grup(), grup({ key: "g2" })]);
    expect(masalah.some(m => /sudah ada grup/i.test(m.message))).toBe(true);
  });

  it("menolak grup wajib yang pilihan aktifnya kurang — tamu akan terkunci", () => {
    const g = grup({
      min_select: 1,
      max_select: 1,
      values: grup().values.map(v => ({ ...v, is_active: false })),
    });
    expect(addonIssues([g]).some(m => /terkunci/i.test(m.message))).toBe(true);
  });

  it("menolak selisih harga pecahan", () => {
    const g = grup({ values: [{ key: "v1", name: "Large", price_delta: 1500.5, is_active: true, recipes: [] }] });
    expect(addonIssues([g]).some(m => m.valueKey === "v1")).toBe(true);
  });

  it("menerima selisih harga negatif — 'Tanpa Keju −2.000' itu sah", () => {
    const g = grup({ values: [{ key: "v1", name: "Tanpa Keju", price_delta: -2000, is_active: true, recipes: [] }] });
    expect(addonIssues([g])).toEqual([]);
  });
});

describe("sepakat dengan validator server", () => {
  const kasus: Array<[string, AddonGroupDraft[]]> = [
    ["grup benar", [grup()]],
    ["grup tanpa nama", [grup({ name: "" })]],
    ["grup tanpa pilihan", [grup({ values: [] })]],
    ["nama pilihan kembar", [grup({ values: [
      { key: "v1", name: "Large", price_delta: 0, is_active: true, recipes: [] },
      { key: "v2", name: "Large", price_delta: 0, is_active: true, recipes: [] },
    ] })]],
    ["max melebihi jumlah pilihan", [grup({ min_select: 0, max_select: 9 })]],
    ["11 grup", Array.from({ length: 11 }, (_, i) => grup({ key: `g${i}`, name: `Grup ${i}` }))],
  ];

  it.each(kasus)("%s: formulir dan server sepakat menerima/menolak", (_nama, groups) => {
    const formulirMenolak = addonIssues(groups).length > 0;
    const serverMenolak = optionGroupsValidationError(keDraftServer(groups)) !== undefined;
    expect(formulirMenolak).toBe(serverMenolak);
  });
});

describe("addonPriceSpan", () => {
  it("tanpa grup, rentangnya hanya harga menu", () => {
    expect(addonPriceSpan(25000, [])).toEqual({ min: 25000, max: 25000, adaRentang: false });
  });

  it("grup WAJIB berbayar menaikkan lantai harga, bukan cuma langit-langitnya", () => {
    const g = grup({
      min_select: 1,
      max_select: 1,
      values: [
        { key: "v1", name: "Sedang", price_delta: 5000, is_active: true, recipes: [] },
        { key: "v2", name: "Besar", price_delta: 9000, is_active: true, recipes: [] },
      ],
    });
    expect(addonPriceSpan(25000, [g])).toMatchObject({ min: 30000, max: 34000 });
  });

  it("grup opsional hanya menaikkan langit-langit", () => {
    const g = applyRule(grup({ values: [
      { key: "v1", name: "Keju", price_delta: 5000, is_active: true, recipes: [] },
      { key: "v2", name: "Telur", price_delta: 4000, is_active: true, recipes: [] },
      { key: "v3", name: "Sosis", price_delta: 6000, is_active: true, recipes: [] },
    ] }), "banyak");
    // maks 3 centang: 25.000 → 25.000 sampai 25.000 + 15.000
    expect(addonPriceSpan(25000, [normalizeGroup(g)])).toMatchObject({ min: 25000, max: 40000 });
  });

  it("selisih negatif menurunkan lantai harga hanya kalau tamu boleh memilihnya", () => {
    const opsional = normalizeGroup(applyRule(grup({ values: [
      { key: "v1", name: "Tanpa Keju", price_delta: -2000, is_active: true, recipes: [] },
      { key: "v2", name: "Extra Keju", price_delta: 3000, is_active: true, recipes: [] },
    ] }), "banyak"));
    expect(addonPriceSpan(25000, [opsional])).toMatchObject({ min: 23000, max: 28000 });
  });

  it("pilihan nonaktif tidak ikut dihitung — tamu tak pernah melihatnya", () => {
    const g = grup({
      min_select: 1,
      max_select: 1,
      values: [
        { key: "v1", name: "Reguler", price_delta: 0, is_active: true, recipes: [] },
        { key: "v2", name: "Jumbo", price_delta: 20000, is_active: false, recipes: [] },
      ],
    });
    expect(addonPriceSpan(25000, [g])).toMatchObject({ min: 25000, max: 25000 });
  });

  it("menjumlahkan beberapa grup sekaligus", () => {
    const ukuran = grup({
      min_select: 1,
      max_select: 1,
      values: [
        { key: "v1", name: "Reguler", price_delta: 0, is_active: true, recipes: [] },
        { key: "v2", name: "Upsize", price_delta: 6000, is_active: true, recipes: [] },
      ],
    });
    const topping = normalizeGroup(presetToGroup(ADDON_PRESETS.find(p => p.label === "Topping")!));
    // 40.000 dasar + 6.000 upsize + (5.000 + 4.000 + 6.000) topping = 61.000
    expect(addonPriceSpan(40000, [ukuran, topping])).toMatchObject({ min: 40000, max: 61000 });
  });
});

describe("cetakan siap pakai", () => {
  it("setiap cetakan langsung lolos validasi tanpa disentuh", () => {
    for (const preset of ADDON_PRESETS) {
      expect(addonIssues([presetToGroup(preset)])).toEqual([]);
    }
  });

  it("cetakan wajib benar-benar mewajibkan", () => {
    const ukuran = presetToGroup(ADDON_PRESETS.find(p => p.label === "Ukuran")!);
    expect(ruleOf(ukuran)).toBe("wajib");
  });
});

describe("withKeys", () => {
  it("memberi kunci unik pada tiap grup dan pilihan dari server", () => {
    const groups = withKeys([
      { name: "Ukuran", min_select: 1, max_select: 1, values: [
        { name: "Reguler", price_delta: 0, is_active: true, recipes: [] },
        { name: "Large", price_delta: 5000, is_active: true, recipes: [] },
      ] },
      { name: "Topping", min_select: 0, max_select: 2, values: [
        { name: "Keju", price_delta: 5000, is_active: true, recipes: [{ inventory_item_id: "i1", qty_per_menu: 1 }] },
      ] },
    ]);

    const kunci = [
      ...groups.map(g => g.key),
      ...groups.flatMap(g => g.values.map(v => v.key)),
    ];
    expect(new Set(kunci).size).toBe(kunci.length);
    // Resep inventory menumpang utuh: editor ini tidak menyuntingnya, tapi RPC
    // menulis ulang seluruh grup — menjatuhkannya di sini memutus potongan stok.
    expect(groups[1].values[0].recipes).toEqual([{ inventory_item_id: "i1", qty_per_menu: 1 }]);
  });
});

describe("emptyValue", () => {
  it("pilihan baru selalu aktif — pemilik menambahkannya untuk dijual", () => {
    expect(emptyValue().is_active).toBe(true);
  });
});
