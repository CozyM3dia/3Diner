/** Validasi unggahan di drawer Edit Menu — pesan Indonesia yang sudah dipakai QA. */

export const MAX_FOTO = 5 * 1024 * 1024;
export const MAX_MODEL = 60 * 1024 * 1024;

export function validateMenuPhoto(file: File): string | null {
  if (!file.type.startsWith("image/")) {
    return "File harus berupa gambar (JPG/PNG/WebP).";
  }
  if (file.size > MAX_FOTO) {
    return "Ukuran foto maksimal 5MB.";
  }
  return null;
}

export function validateMenuModel(file: File): string | null {
  if (!/\.(glb|gltf)$/i.test(file.name)) {
    return "Format model harus .glb atau .gltf.";
  }
  if (file.size > MAX_MODEL) {
    return "Ukuran model maksimal 60MB.";
  }
  return null;
}
