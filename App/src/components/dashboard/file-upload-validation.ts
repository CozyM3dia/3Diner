/** Client-side checks for dashboard media slots — run BEFORE createMediaUploadUrl. */

const DEFAULT_MAX_MB = 30;
const GENERIC_BINARY = "application/octet-stream";

const MIME_EXTENSIONS: Record<string, string[]> = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
  "image/avif": [".avif"],
  "image/gif": [".gif"],
  "image/svg+xml": [".svg"],
  "application/pdf": [".pdf"],
  "model/gltf-binary": [".glb"],
  "model/gltf+json": [".gltf"],
  "model/vnd.usdz+zip": [".usdz"],
};

export function parseMaxSizeMB(hint?: string, fallback = DEFAULT_MAX_MB): number {
  if (!hint) return fallback;
  const match = hint.match(/(\d+)\s*MB/i);
  if (!match) return fallback;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function fileNameFromUrl(url: string): string {
  try {
    const path = decodeURIComponent(url.split("?")[0] ?? url);
    const last = path.split("/").pop() ?? url;
    return last.replace(/^\d+-/, "");
  } catch {
    return url;
  }
}

function tokensOf(accept: string): string[] {
  return accept
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

function nameMatchesExt(name: string, ext: string): boolean {
  return name.endsWith(ext.startsWith(".") ? ext : `.${ext}`);
}

export function fileMatchesAccept(file: File, accept: string): boolean {
  const tokens = tokensOf(accept);
  if (tokens.length === 0) return true;

  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();
  const extensions = tokens.filter((t) => t.startsWith("."));
  const mimes = tokens.filter((t) => !t.startsWith("."));

  if (extensions.some((ext) => nameMatchesExt(name, ext))) return true;

  for (const mime of mimes) {
    if (mime === GENERIC_BINARY) continue;
    if (mime.endsWith("/*")) {
      const prefix = mime.slice(0, -1);
      if (type.startsWith(prefix)) return true;
      if (!type && prefix === "image/") {
        const imageExts = Object.entries(MIME_EXTENSIONS)
          .filter(([m]) => m.startsWith("image/"))
          .flatMap(([, exts]) => exts);
        if (imageExts.some((ext) => nameMatchesExt(name, ext))) return true;
      }
      continue;
    }
    if (type && type === mime) return true;
    const inferred = MIME_EXTENSIONS[mime];
    if ((!type || type === GENERIC_BINARY) && inferred?.some((ext) => nameMatchesExt(name, ext))) {
      return true;
    }
  }

  return false;
}

export function validateUploadFile(file: File, accept: string, maxSizeMB: number): string | null {
  if (accept && !fileMatchesAccept(file, accept)) {
    return `Jenis file tidak diterima. Gunakan: ${accept}`;
  }
  if (maxSizeMB > 0 && file.size > maxSizeMB * 1024 * 1024) {
    return `File terlalu besar. Maksimal ${maxSizeMB}MB.`;
  }
  return null;
}

export function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return [".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".svg"].some((ext) =>
    file.name.toLowerCase().endsWith(ext)
  );
}
