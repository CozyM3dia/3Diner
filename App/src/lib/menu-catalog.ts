/** Remove accidental duplicate catalog rows from presentation lists.
 *  A repeated name with the same image is the same visible item, not a second
 *  choice. Keep the first row so its stable id/options remain authoritative. */
export function dedupeMenuCatalog<T extends { nama_menu?: string | null; image_url?: string | null }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const name = String(row.nama_menu ?? "")
      .trim()
      .replace(/\s*\((?:compress|generate\s+\d+)\)\s*$/i, "")
      .toLocaleLowerCase("id-ID");
    const image = String(row.image_url ?? "").trim();
    const key = `${name}\u0000${image}`;
    if (!name || seen.has(key)) return !name ? true : false;
    seen.add(key);
    return true;
  });
}
