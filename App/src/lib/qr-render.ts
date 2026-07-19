/** Pure helpers untuk rendering QR Smart Menu.
 *  Tanpa DOM — dipakai preview client, ekspor SVG, dan unit test. */

export interface QrMatrix {
  size: number;
  /** Row-major; truthy = modul gelap. `QRCode.create().modules` kompatibel. */
  data: ArrayLike<number | boolean>;
}

export interface QrSvgOptions {
  /** Warna modul QR — wajib gelap demi kontras scan. */
  moduleColor: string;
  /** Permukaan scan — near-white. */
  background: string;
  /** Bingkai 3Diner: border navy + identitas mikro di bawah. */
  frame?: boolean;
  /** Logo tengah. `href` boleh path same-origin (preview) atau data URI (ekspor). */
  logo?: { href: string };
  captionName?: string;
  captionScan?: string;
  captionDomain?: string;
  /** Metadata accessible. */
  title: string;
  desc: string;
}

/** Quiet zone minimum 4 modul di setiap sisi (spek QR). */
export const QUIET_ZONE = 4;

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** `3diner-qr-menu-[slug].[ext]` — slug disanitasi ke [a-z0-9-]. */
export function qrFileName(slug: string, ext: "png" | "svg"): string {
  const safe = slug
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
  return `3diner-qr-menu-${safe || "kafe"}.${ext}`;
}

/** Path data untuk semua modul gelap (1 unit = 1 modul). */
export function modulesToPath(matrix: QrMatrix): string {
  const { size, data } = matrix;
  let d = "";
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (data[r * size + c]) d += `M${c} ${r}h1v1h-1z`;
    }
  }
  return d;
}

export interface QrSvgLayout {
  /** Lebar total dalam unit modul. */
  width: number;
  height: number;
  /** Offset kiri/atas area QR (setelah quiet zone + padding frame). */
  qrOffset: number;
}

export function computeLayout(matrix: QrMatrix, opts: QrSvgOptions): QrSvgLayout {
  const framePad = opts.frame ? 2 : 0;
  const qrOffset = QUIET_ZONE + framePad;
  const width = matrix.size + 2 * qrOffset;
  const captionLines =
    (opts.captionName ? 3.4 : 0) +
    (opts.captionScan ? 2.6 : 0) +
    (opts.captionDomain ? 2.4 : 0) +
    (opts.frame ? 2.4 : 0);
  const height = width + (captionLines > 0 ? captionLines + 1.5 : 0);
  return { width, height, qrOffset };
}

/** SVG vector murni: modul = satu <path>, caption <text>, logo opsional <image>. */
export function buildQrSvg(matrix: QrMatrix, opts: QrSvgOptions): string {
  const { width, height, qrOffset } = computeLayout(matrix, opts);
  const font = "Poppins, system-ui, sans-serif";
  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="qr-title qr-desc">`
  );
  parts.push(`<title id="qr-title">${escapeXml(opts.title)}</title>`);
  parts.push(`<desc id="qr-desc">${escapeXml(opts.desc)}</desc>`);
  parts.push(`<rect width="${width}" height="${height}" rx="2.5" fill="${escapeXml(opts.background)}"/>`);

  if (opts.frame) {
    parts.push(
      `<rect x="0.9" y="0.9" width="${width - 1.8}" height="${height - 1.8}" rx="2" fill="none" stroke="#022C60" stroke-width="0.7"/>`
    );
  }

  parts.push(
    `<path transform="translate(${qrOffset} ${qrOffset})" d="${modulesToPath(matrix)}" fill="${escapeXml(opts.moduleColor)}"/>`
  );

  if (opts.logo) {
    // Backing putih menjaga kontras; EC level H mengkompensasi modul tertutup (≤ ~4% area).
    const box = Math.round(matrix.size * 0.2);
    const x = qrOffset + (matrix.size - box) / 2;
    parts.push(
      `<rect x="${x - 0.8}" y="${x - 0.8}" width="${box + 1.6}" height="${box + 1.6}" rx="1.2" fill="${escapeXml(opts.background)}"/>`
    );
    parts.push(
      `<image href="${escapeXml(opts.logo.href)}" x="${x}" y="${x}" width="${box}" height="${box}" preserveAspectRatio="xMidYMid meet"/>`
    );
  }

  let ty = width + 1.2;
  if (opts.captionName) {
    ty += 2.4;
    parts.push(
      `<text x="${width / 2}" y="${ty}" text-anchor="middle" font-family="${font}" font-weight="600" font-size="2.4" fill="#022C60">${escapeXml(opts.captionName)}</text>`
    );
    ty += 1;
  }
  if (opts.captionScan) {
    ty += 1.9;
    parts.push(
      `<text x="${width / 2}" y="${ty}" text-anchor="middle" font-family="${font}" font-weight="400" font-size="1.7" fill="#51698F">${escapeXml(opts.captionScan)}</text>`
    );
    ty += 0.7;
  }
  if (opts.captionDomain) {
    ty += 1.8;
    parts.push(
      `<text x="${width / 2}" y="${ty}" text-anchor="middle" font-family="${font}" font-weight="500" font-size="1.5" fill="#51698F">${escapeXml(opts.captionDomain)}</text>`
    );
    ty += 0.6;
  }
  if (opts.frame) {
    ty += 1.7;
    parts.push(
      `<text x="${width / 2}" y="${ty}" text-anchor="middle" font-family="${font}" font-weight="600" font-size="1.3" letter-spacing="0.12" fill="#FD5002">3DINER SMART MENU</text>`
    );
  }

  parts.push("</svg>");
  return parts.join("");
}
