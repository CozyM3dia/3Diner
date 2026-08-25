import { describe, expect, it } from "vitest";

import type { StaffContext } from "@/types";

/** Kontrak §7 dokumen induk: "bukan staf di sini" dan "gagal memuat" harus
 *  bisa dibedakan pemanggil. Sejak 26 Aug 2026 perbedaannya ada di bentuk
 *  data (`error: true`), bukan cuma di komentar. */
describe("StaffContext: membedakan bukan-staf dari gagal muat", () => {
  const bukanStaf: StaffContext = { role: null };
  const gagalMuat: StaffContext = { role: null, error: true };

  it("bukan staf tidak membawa flag error", () => {
    expect(bukanStaf.role).toBeNull();
    expect(bukanStaf.error).toBeUndefined();
  });

  it("gagal memuat ditandai eksplisit dengan error: true", () => {
    expect(gagalMuat.error).toBe(true);
  });

  it("keduanya tidak bisa dibedakan kalau flag hilang — bentuk kontrak mencegahnya", () => {
    // Guard bentuk: dua keadaan ini TIDAK boleh identik secara struktur.
    expect(bukanStaf).not.toEqual(gagalMuat);
  });

  it("konteks staf sah tidak menyentuh flag error", () => {
    const owner: StaffContext = { role: "owner", cafe_id: "c1", is_active: true };
    expect(owner.error).toBeUndefined();
  });
});
