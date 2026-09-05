import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "src");
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("dashboard-v2 bahasa antarmuka", () => {
  it("uses Indonesian labels for the reported dashboard surfaces", () => {
    expect(read("app/dashboard-v2/kategori/page.tsx")).toContain('title: "Kategori · 3Diner"');
    expect(read("app/dashboard-v2/items/page.tsx")).toContain('title: "Item · 3Diner"');
    expect(read("app/dashboard-v2/pengaturan/pajak/page.tsx")).toContain('title: "Pengaturan Pajak · 3Diner"');
    expect(read("app/dashboard-v2/pengaturan/notifikasi/page.tsx")).toContain('title: "Notifikasi · 3Diner"');
    expect(read("app/dashboard-v2/pengaturan/peran/page.tsx")).toContain('title: "Peran & Izin · 3Diner"');
    expect(read("app/dashboard-v2/pengaturan/staf/page.tsx")).toContain('title: "Kelola Staf · 3Diner"');
    const ui = [
      read("components/dp/CategoriesTable.tsx"),
      read("components/dp/ItemsGrid.tsx"),
      read("components/dp/TaxSettingsForm.tsx"),
      read("components/dp/StaffManager.tsx"),
      read("components/dp/ProfileMenu.tsx"),
    ].join("\n");
    expect(ui).toContain(">Aksi<");
    expect(ui).toContain("Simpan");
    expect(ui).toContain("Kelola Staf");
    expect(ui).not.toMatch(/>\s*(Categories|Items|Tax Settings|Notifications|Roles &amp; Permissions|Manage Staffs|Save Changes|Actions)\s*</);
  });
});
