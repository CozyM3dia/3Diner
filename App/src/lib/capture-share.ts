/** Menyusun frame hasil tangkapan viewer 3D jadi gambar siap bagikan.
 *
 *  Foto yang dibagikan tamu adalah kanal akuisisi utama menurut STRATEGY.md §3,
 *  jadi setiap gambar harus membawa nama kafe. Tanpa itu, share bagus untuk
 *  tamu tapi tidak menghasilkan apa pun buat kafe yang membayar. */

export interface ComposeOptions {
  /** Data URL dari canvas viewer. */
  frameDataUrl: string;
  menuName: string;
  cafeName: string;
}

const BRAND_HEIGHT = 132;

export async function composeShareImage({
  frameDataUrl,
  menuName,
  cafeName,
}: ComposeOptions): Promise<Blob | null> {
  const frame = await loadImage(frameDataUrl);
  if (!frame) return null;

  const canvas = document.createElement("canvas");
  canvas.width = frame.width;
  canvas.height = frame.height + BRAND_HEIGHT;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Latar mengikuti --paper: canvas viewer transparan, dan PNG transparan yang
  // dibagikan ke WhatsApp atau Instagram akan tampil hitam.
  ctx.fillStyle = "#F6F8FB";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(frame, 0, 0);

  const scale = frame.width / 1080;
  const pad = Math.round(48 * scale);
  const baseY = frame.height;

  ctx.fillStyle = "#022C60";
  ctx.fillRect(0, baseY, canvas.width, BRAND_HEIGHT);

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#FDFDFD";
  ctx.font = `700 ${Math.round(38 * scale)}px "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillText(truncate(ctx, menuName, canvas.width - pad * 2), pad, baseY + Math.round(58 * scale));

  ctx.fillStyle = "#FD5002";
  ctx.font = `600 ${Math.round(26 * scale)}px Outfit, system-ui, sans-serif`;
  ctx.fillText(truncate(ctx, cafeName, canvas.width - pad * 2), pad, baseY + Math.round(98 * scale));

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut}…`;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

export type ShareOutcome = "shared" | "downloaded" | "failed";

/** Membagikan gambar lewat Web Share API, dengan unduhan sebagai jalur mundur.
 *
 *  Web Share level 2 belum ada di sebagian browser desktop dan beberapa
 *  in-app browser, jadi kegagalan berbagi tidak boleh membuat tamu kehilangan
 *  gambarnya. */
export async function shareImage(blob: Blob, fileName: string, title: string): Promise<ShareOutcome> {
  const file = new File([blob], fileName, { type: "image/png" });

  if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return "shared";
    } catch (error) {
      // Tamu menutup lembar berbagi: itu keputusan mereka, bukan kegagalan,
      // dan tidak boleh memicu unduhan yang tidak diminta.
      if (error instanceof DOMException && error.name === "AbortError") return "shared";
    }
  }

  try {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
    return "downloaded";
  } catch {
    return "failed";
  }
}

/** Nama berkas yang aman untuk semua sistem berkas dan enak dilihat di galeri. */
export function shareFileName(menuName: string, cafeName: string): string {
  const slug = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);

  const parts = [slug(menuName), slug(cafeName)].filter(Boolean);
  return `3diner-${parts.join("-") || "dish"}.png`;
}
