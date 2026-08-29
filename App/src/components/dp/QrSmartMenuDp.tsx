"use client";

import { useMemo, useState } from "react";
import QRCode from "qrcode";
import {
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  Loader2Icon,
  QrCodeIcon,
} from "lucide-react";
import { buildQrSvg, computeLayout, qrFileName, type QrMatrix, type QrSvgOptions } from "@/lib/qr-render";

/** QR Smart Menu untuk konsol dp — port fungsional dari
 *  `components/dashboard/QrSmartMenu.tsx` (dashboard legacy), markup-nya
 *  digaya ulang ke class dp. Semua kontrol nyata: copy, buka menu,
 *  unduh PNG 2048px / SVG, dan kustomisasi tampilan QR. */

const NAVY = "#022C60";
const DARK = "#10151D";
const SURFACE = "#FDFDFD";
const LOGO_PATH = "/brand/logo-3diner-mark.png";
const SCAN_CAPTION = "Scan untuk melihat menu";

type QrColor = "navy" | "dark";
type QrStyle = "bersih" | "bingkai";

function shortPath(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

export default function QrSmartMenuDp({
  menuUrl,
  cafeName,
  slug,
}: {
  menuUrl: string | null;
  cafeName: string;
  slug: string | null;
}) {
  const [style, setStyle] = useState<QrStyle>("bersih");
  const [color, setColor] = useState<QrColor>("navy");
  const [logoOn, setLogoOn] = useState(false);
  const [showName, setShowName] = useState(true);
  const [showScan, setShowScan] = useState(true);
  const [customOpen, setCustomOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState<"png" | "svg" | null>(null);
  const [exportMsg, setExportMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const matrix = useMemo<QrMatrix | null>(() => {
    if (!menuUrl) return null;
    try {
      const qr = QRCode.create(menuUrl, { errorCorrectionLevel: logoOn ? "H" : "M" });
      return { size: qr.modules.size, data: qr.modules.data };
    } catch {
      return null;
    }
  }, [menuUrl, logoOn]);

  const svgOptions = useMemo<QrSvgOptions | null>(() => {
    if (!menuUrl) return null;
    return {
      moduleColor: color === "navy" ? NAVY : DARK,
      background: SURFACE,
      frame: style === "bingkai",
      logo: logoOn ? { href: LOGO_PATH } : undefined,
      captionName: showName ? cafeName : undefined,
      captionScan: showScan ? SCAN_CAPTION : undefined,
      captionDomain: shortPath(menuUrl),
      title: `QR menu digital ${cafeName}`,
      desc: `Scan untuk membuka smart menu ${cafeName} di ${menuUrl}`,
    };
  }, [menuUrl, cafeName, color, style, logoOn, showName, showScan]);

  const previewSvg = useMemo(
    () => (matrix && svgOptions ? buildQrSvg(matrix, svgOptions) : null),
    [matrix, svgOptions],
  );

  async function copyUrl() {
    if (!menuUrl) return;
    try {
      await navigator.clipboard.writeText(menuUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setExportMsg({ kind: "err", text: "Gagal menyalin tautan. Salin manual dari kolom di atas." });
    }
  }

  function triggerDownload(href: string, filename: string) {
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke setelah browser sempat memulai unduhan — revoke sinkron bisa membatalkannya.
    setTimeout(() => URL.revokeObjectURL(href), 2000);
  }

  async function logoAsDataUri(): Promise<string | null> {
    try {
      const res = await fetch(LOGO_PATH);
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  async function downloadSvg() {
    if (!matrix || !svgOptions || !slug) return;
    setExporting("svg");
    setExportMsg(null);
    try {
      let opts = svgOptions;
      if (svgOptions.logo) {
        // SVG berdiri sendiri saat dibuka offline — logo di-embed sebagai data URI.
        const dataUri = await logoAsDataUri();
        opts = { ...svgOptions, logo: dataUri ? { href: dataUri } : undefined };
      }
      const svg = buildQrSvg(matrix, opts);
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      triggerDownload(URL.createObjectURL(blob), qrFileName(slug, "svg"));
      setExportMsg({ kind: "ok", text: "SVG terunduh." });
    } catch {
      setExportMsg({ kind: "err", text: "Gagal mengunduh QR. Coba lagi." });
    } finally {
      setExporting(null);
    }
  }

  async function downloadPng() {
    if (!matrix || !svgOptions || !slug) return;
    setExporting("png");
    setExportMsg(null);
    try {
      const layout = computeLayout(matrix, svgOptions);
      const scale = Math.ceil(2048 / layout.width);
      const w = layout.width * scale;
      const h = layout.height * scale;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no-canvas");

      ctx.fillStyle = svgOptions.background;
      ctx.fillRect(0, 0, w, h);

      if (svgOptions.frame) {
        ctx.strokeStyle = NAVY;
        ctx.lineWidth = 0.7 * scale;
        ctx.strokeRect(0.9 * scale, 0.9 * scale, w - 1.8 * scale, h - 1.8 * scale);
      }

      // Modul QR — fillRect integer agar tajam untuk cetak
      ctx.fillStyle = svgOptions.moduleColor;
      const off = layout.qrOffset * scale;
      for (let r = 0; r < matrix.size; r++) {
        for (let c = 0; c < matrix.size; c++) {
          if (matrix.data[r * matrix.size + c]) {
            ctx.fillRect(off + c * scale, off + r * scale, scale, scale);
          }
        }
      }

      if (svgOptions.logo) {
        // Logo same-origin → canvas tidak tainted. Gagal muat = lanjut tanpa logo.
        const img = await new Promise<HTMLImageElement | null>((resolve) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = () => resolve(null);
          el.src = LOGO_PATH;
        });
        if (img) {
          const box = Math.round(matrix.size * 0.2) * scale;
          const x = off + (matrix.size * scale - box) / 2;
          ctx.fillStyle = svgOptions.background;
          const pad = 0.8 * scale;
          ctx.beginPath();
          ctx.roundRect(x - pad, x - pad, box + 2 * pad, box + 2 * pad, 1.2 * scale);
          ctx.fill();
          ctx.drawImage(img, x, x, box, box);
        }
      }

      // Caption — posisi mengikuti computeLayout (sinkron dengan SVG)
      ctx.textAlign = "center";
      const cx = w / 2;
      let ty = (layout.width + 1.2) * scale;
      if (svgOptions.captionName) {
        ty += 2.4 * scale;
        ctx.fillStyle = NAVY;
        ctx.font = `600 ${2.4 * scale}px Poppins, system-ui, sans-serif`;
        ctx.fillText(svgOptions.captionName, cx, ty);
        ty += 1 * scale;
      }
      if (svgOptions.captionScan) {
        ty += 1.9 * scale;
        ctx.fillStyle = "#51698F";
        ctx.font = `400 ${1.7 * scale}px Poppins, system-ui, sans-serif`;
        ctx.fillText(svgOptions.captionScan, cx, ty);
        ty += 0.7 * scale;
      }
      if (svgOptions.captionDomain) {
        ty += 1.8 * scale;
        ctx.fillStyle = "#51698F";
        ctx.font = `500 ${1.5 * scale}px Poppins, system-ui, sans-serif`;
        ctx.fillText(svgOptions.captionDomain, cx, ty);
        ty += 0.6 * scale;
      }
      if (svgOptions.frame) {
        ty += 1.7 * scale;
        ctx.fillStyle = "#FD5002";
        ctx.font = `600 ${1.3 * scale}px Poppins, system-ui, sans-serif`;
        ctx.fillText("3DINER SMART MENU", cx, ty);
      }

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("no-blob");
      triggerDownload(URL.createObjectURL(blob), qrFileName(slug, "png"));
      setExportMsg({ kind: "ok", text: "PNG terunduh." });
    } catch {
      setExportMsg({ kind: "err", text: "Gagal mengunduh QR. Coba lagi." });
    } finally {
      setExporting(null);
    }
  }

  if (!menuUrl || !slug) {
    return (
      <section className="dp-card" aria-label="QR Smart Menu">
        <div className="dp-card-head">
          <h2 className="dp-card-title dp-qr-title">
            <QrCodeIcon className="dp-qr-title-ic" aria-hidden="true" />
            QR Smart Menu
          </h2>
        </div>
        <div className="dp-card-body">
          <p className="dp-empty">Tautan Smart Menu belum tersedia. Lengkapi profil kafe terlebih dahulu.</p>
        </div>
      </section>
    );
  }

  const busy = exporting !== null;

  return (
    <section className="dp-card" aria-label="QR Smart Menu">
      <div className="dp-card-head">
        <h2 className="dp-card-title dp-qr-title">
          <QrCodeIcon className="dp-qr-title-ic" aria-hidden="true" />
          QR Smart Menu
        </h2>
      </div>
      <div className="dp-card-body">
        <p className="dp-qr-desc">
          Bagikan menu digital kafe melalui QR. Pelanggan dapat langsung melihat menu, model 3D, dan mulai memesan.
        </p>

        <div className="dp-qr-grid">
          {/* Pratinjau — aset cetak */}
          <div className="dp-qr-preview">
            {previewSvg ? (
              <div className="dp-qr-svg" dangerouslySetInnerHTML={{ __html: previewSvg }} />
            ) : (
              <p className="dp-empty">QR belum dapat dibuat.</p>
            )}
          </div>

          {/* Kontrol */}
          <div className="dp-qr-controls">
            <label className="dp-label dp-qr-mini" htmlFor="dp-qr-url">
              Tautan Smart Menu
            </label>
            <div className="dp-qr-urlrow">
              <div className="dp-field dp-qr-url">
                <input id="dp-qr-url" readOnly value={menuUrl} onFocus={e => e.currentTarget.select()} />
                <button
                  type="button"
                  className="dp-round-btn dp-qr-copy"
                  onClick={copyUrl}
                  title={copied ? "Tautan disalin" : "Salin tautan"}
                  aria-label={copied ? "Tautan disalin" : "Salin tautan smart menu"}
                >
                  {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
                </button>
              </div>
              <a
                href={menuUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="dp-btn-white dp-qr-buka"
              >
                <ExternalLinkIcon className="h-4 w-4" aria-hidden="true" />
                Buka Menu
              </a>
            </div>
            <p aria-live="polite" className="dp-qr-msg dp-qr-msg-ok">
              {copied ? "Tautan disalin" : ""}
            </p>

            <div className="dp-qr-downloads">
              <button type="button" onClick={downloadPng} disabled={busy || !previewSvg} className="dp-add-btn">
                {exporting === "png" ? (
                  <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <DownloadIcon className="h-4 w-4" aria-hidden="true" />
                )}
                Unduh PNG
              </button>
              <button type="button" onClick={downloadSvg} disabled={busy || !previewSvg} className="dp-btn-white">
                {exporting === "svg" ? (
                  <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <DownloadIcon className="h-4 w-4" aria-hidden="true" />
                )}
                Unduh SVG
              </button>
            </div>
            <p aria-live="polite" className={`dp-qr-msg${exportMsg?.kind === "err" ? " dp-qr-msg-err" : " dp-qr-msg-ok"}`}>
              {exportMsg?.text ?? ""}
            </p>
            <p className="dp-qr-hint">PNG 2048px siap cetak. Cetak minimal 3×3 cm agar mudah discan dari meja.</p>

            {/* Kustomisasi — disclosure */}
            <div className="dp-qr-custom">
              <button
                type="button"
                className="dp-qr-custom-toggle"
                aria-expanded={customOpen}
                onClick={() => setCustomOpen(v => !v)}
              >
                <ChevronDownIcon
                  className="h-4 w-4"
                  style={{ transform: customOpen ? "rotate(180deg)" : "none", transition: "transform .18s ease" }}
                  aria-hidden="true"
                />
                Sesuaikan Tampilan QR
              </button>

              {customOpen && (
                <div className="dp-qr-custom-body">
                  <fieldset>
                    <legend className="dp-qr-mini">Style</legend>
                    <div className="dp-qr-chips">
                      <button type="button" className={`dp-qr-chip${style === "bersih" ? " dp-qr-chip-on" : ""}`} aria-pressed={style === "bersih"} onClick={() => setStyle("bersih")}>
                        Bersih
                      </button>
                      <button type="button" className={`dp-qr-chip${style === "bingkai" ? " dp-qr-chip-on" : ""}`} aria-pressed={style === "bingkai"} onClick={() => setStyle("bingkai")}>
                        Bingkai 3Diner
                      </button>
                    </div>
                  </fieldset>

                  <fieldset>
                    <legend className="dp-qr-mini">Warna QR</legend>
                    <div className="dp-qr-chips">
                      <button type="button" className={`dp-qr-chip${color === "navy" ? " dp-qr-chip-on" : ""}`} aria-pressed={color === "navy"} onClick={() => setColor("navy")}>
                        <span className="dp-qr-dot" style={{ background: NAVY }} aria-hidden="true" />
                        Navy 3Diner
                      </button>
                      <button type="button" className={`dp-qr-chip${color === "dark" ? " dp-qr-chip-on" : ""}`} aria-pressed={color === "dark"} onClick={() => setColor("dark")}>
                        <span className="dp-qr-dot" style={{ background: DARK }} aria-hidden="true" />
                        Gelap Pekat
                      </button>
                    </div>
                  </fieldset>

                  <fieldset>
                    <legend className="dp-qr-mini">Elemen</legend>
                    <label className="dp-switch">
                      <input type="checkbox" checked={logoOn} onChange={e => setLogoOn(e.target.checked)} />
                      <i aria-hidden="true" />
                      <span>
                        Logo 3Diner di tengah QR
                        <small>Koreksi error otomatis naik ke level H</small>
                      </span>
                    </label>
                    <label className="dp-switch">
                      <input type="checkbox" checked={showName} onChange={e => setShowName(e.target.checked)} />
                      <i aria-hidden="true" />
                      <span>Tampilkan nama kafe</span>
                    </label>
                    <label className="dp-switch">
                      <input type="checkbox" checked={showScan} onChange={e => setShowScan(e.target.checked)} />
                      <i aria-hidden="true" />
                      <span>Tampilkan teks &quot;{SCAN_CAPTION}&quot;</span>
                    </label>
                  </fieldset>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
