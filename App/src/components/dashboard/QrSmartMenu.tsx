"use client";

import { useMemo, useState } from "react";
import QRCode from "qrcode";
import {
  Check,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  QrCode as QrCodeIcon,
} from "lucide-react";
import { buildQrSvg, computeLayout, qrFileName, type QrMatrix, type QrSvgOptions } from "@/lib/qr-render";

interface QrSmartMenuProps {
  /** URL menu publik kanonik, null bila slug kafe belum ada. */
  menuUrl: string | null;
  cafeName: string;
  slug: string | null;
}

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

export default function QrSmartMenu({ menuUrl, cafeName, slug }: QrSmartMenuProps) {
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
    [matrix, svgOptions]
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

      // Latar scan surface
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

  const heading = (
    <div className="dash-panel-head">
      <QrCodeIcon size={13} aria-hidden="true" />
      QR Smart Menu
    </div>
  );

  if (!menuUrl || !slug) {
    return (
      <section id="qr-menu" aria-label="QR Smart Menu" className="dash-panel dash-reveal">
        {heading}
        <div className="dash-panel-body">
          <p className="text-sm font-medium" style={{ color: "var(--dash-text)" }}>
            Tautan Smart Menu belum tersedia.
          </p>
          <p className="text-[13px] mt-1" style={{ color: "var(--dash-muted)" }}>
            QR belum dapat dibuat karena tautan menu kafe belum tersedia. Lengkapi profil kafe terlebih dahulu.
          </p>
        </div>
      </section>
    );
  }

  const busy = exporting !== null;
  const chip = (selected: boolean): React.CSSProperties => ({
    background: selected ? "var(--dash-raised)" : "transparent",
    color: selected ? "var(--dash-text)" : "var(--dash-muted)",
    border: `1px solid ${selected ? "var(--dash-border-strong)" : "var(--dash-border)"}`,
    minHeight: "44px",
  });

  return (
    <section id="qr-menu" aria-label="QR Smart Menu" className="dash-panel dash-reveal">
      {heading}
      <div className="dash-panel-body">
        <p className="text-[13px] -mt-1 mb-4" style={{ color: "var(--dash-secondary)" }}>
          Bagikan menu digital kafe melalui QR. Pelanggan dapat langsung melihat menu, model 3D, dan mulai memesan.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(260px,38%)_1fr] gap-5 lg:gap-7 items-start">
          {/* Preview — aset cetak */}
          <div className="rounded-xl p-4 flex justify-center" style={{ background: "var(--dash-raised)" }}>
            <div className="w-full max-w-[280px]" aria-hidden={previewSvg ? undefined : true}>
              {previewSvg ? (
                <div
                  className="rounded-lg overflow-hidden"
                  style={{ boxShadow: "0 4px 18px rgba(0,0,0,0.3)" }}
                  dangerouslySetInnerHTML={{ __html: previewSvg }}
                />
              ) : (
                <p className="text-[13px] py-10 text-center" style={{ color: "var(--dash-muted)" }}>
                  QR belum dapat dibuat karena tautan menu kafe belum tersedia.
                </p>
              )}
            </div>
          </div>

          {/* Kontrol */}
          <div className="min-w-0">
            <label
              htmlFor="qr-menu-url"
              className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: "var(--dash-muted)" }}
            >
              Tautan Smart Menu
            </label>
            <div className="flex items-center gap-2">
              <div
                className="flex items-center flex-1 min-w-0 rounded-xl overflow-hidden"
                style={{ background: "var(--dash-raised)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <input
                  id="qr-menu-url"
                  readOnly
                  value={menuUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 min-w-0 bg-transparent px-3.5 text-sm outline-none truncate"
                  style={{ color: "var(--dash-text)", height: "44px" }}
                />
                <button
                  type="button"
                  onClick={copyUrl}
                  title={copied ? "Tautan disalin" : "Salin tautan"}
                  aria-label={copied ? "Tautan disalin" : "Salin tautan smart menu"}
                  className="dash-press shrink-0 flex items-center justify-center"
                  style={{
                    width: "44px",
                    height: "44px",
                    color: copied ? "#22D3A6" : "var(--dash-secondary)",
                    transition: "color 180ms cubic-bezier(0.22,1,0.36,1)",
                  }}
                >
                  {copied ? <Check size={16} /> : <Copy size={15} />}
                </button>
              </div>
              <a
                href={menuUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="dash-btn shrink-0 inline-flex items-center gap-2 px-3.5 rounded-xl text-[13px] font-semibold"
                style={{
                  background: "var(--dash-raised)",
                  color: "var(--dash-text)",
                  border: "1px solid var(--dash-border)",
                  height: "44px",
                }}
              >
                <ExternalLink size={14} aria-hidden="true" />
                Buka Menu
              </a>
            </div>
            <p aria-live="polite" className="text-[12px] mt-1.5 min-h-[18px]" style={{ color: "#22D3A6" }}>
              {copied ? "Tautan disalin" : ""}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3">
              <button
                type="button"
                onClick={downloadPng}
                disabled={busy || !previewSvg}
                className="dash-btn inline-flex items-center justify-center gap-2 rounded-xl text-[13px] font-semibold text-white disabled:opacity-60"
                style={{ background: "var(--orange)", height: "44px" }}
              >
                {exporting === "png" ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Download size={15} aria-hidden="true" />}
                Unduh PNG
              </button>
              <button
                type="button"
                onClick={downloadSvg}
                disabled={busy || !previewSvg}
                className="dash-btn inline-flex items-center justify-center gap-2 rounded-xl text-[13px] font-semibold disabled:opacity-60"
                style={{
                  background: "var(--dash-raised)",
                  color: "var(--dash-text)",
                  border: "1px solid var(--dash-border)",
                  height: "44px",
                }}
              >
                {exporting === "svg" ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Download size={15} aria-hidden="true" />}
                Unduh SVG
              </button>
            </div>

            <p aria-live="polite" className="text-[12px] mt-2 min-h-[18px]" style={{ color: exportMsg?.kind === "err" ? "#FCA5A5" : "#22D3A6" }}>
              {exportMsg?.text ?? ""}
            </p>

            <p className="text-[12px] mt-1" style={{ color: "var(--dash-muted)" }}>
              PNG 2048px siap cetak. Cetak minimal 3×3 cm agar mudah discan dari meja.
            </p>

            {/* Kustomisasi — disclosure */}
            <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--dash-border)" }}>
              <button
                type="button"
                onClick={() => setCustomOpen((v) => !v)}
                aria-expanded={customOpen}
                aria-controls="qr-custom-panel"
                className="dash-press flex items-center gap-2 text-[13px] font-semibold"
                style={{ color: "var(--dash-secondary)", minHeight: "44px" }}
              >
                <ChevronDown
                  size={15}
                  aria-hidden="true"
                  style={{
                    transform: customOpen ? "rotate(180deg)" : "none",
                    transition: "transform 180ms cubic-bezier(0.22,1,0.36,1)",
                  }}
                />
                Sesuaikan Tampilan QR
              </button>

              {customOpen && (
                <div id="qr-custom-panel" className="mt-3 space-y-4">
                  <fieldset>
                    <legend className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--dash-muted)" }}>
                      Style
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => setStyle("bersih")} aria-pressed={style === "bersih"} className="dash-chip px-3.5 rounded-[10px] text-[13px] font-medium" style={chip(style === "bersih")}>
                        Bersih
                      </button>
                      <button type="button" onClick={() => setStyle("bingkai")} aria-pressed={style === "bingkai"} className="dash-chip px-3.5 rounded-[10px] text-[13px] font-medium" style={chip(style === "bingkai")}>
                        Bingkai 3Diner
                      </button>
                    </div>
                  </fieldset>

                  <fieldset>
                    <legend className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--dash-muted)" }}>
                      Warna QR
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => setColor("navy")} aria-pressed={color === "navy"} className="dash-chip inline-flex items-center gap-2 px-3.5 rounded-[10px] text-[13px] font-medium" style={chip(color === "navy")}>
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: NAVY, border: "1px solid rgba(255,255,255,0.25)" }} aria-hidden="true" />
                        Navy 3Diner
                      </button>
                      <button type="button" onClick={() => setColor("dark")} aria-pressed={color === "dark"} className="dash-chip inline-flex items-center gap-2 px-3.5 rounded-[10px] text-[13px] font-medium" style={chip(color === "dark")}>
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: DARK, border: "1px solid rgba(255,255,255,0.25)" }} aria-hidden="true" />
                        Gelap Pekat
                      </button>
                    </div>
                  </fieldset>

                  <fieldset>
                    <legend className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--dash-muted)" }}>
                      Elemen
                    </legend>
                    <div className="space-y-1">
                      <CheckRow checked={logoOn} onChange={setLogoOn} label="Logo 3Diner di tengah QR" hint="Koreksi error otomatis naik ke level H" />
                      <CheckRow checked={showName} onChange={setShowName} label="Tampilkan nama kafe" />
                      <CheckRow checked={showScan} onChange={setShowScan} label={`Tampilkan teks "${SCAN_CAPTION}"`} />
                    </div>
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

function CheckRow({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer" style={{ minHeight: "44px" }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded accent-[#FD5002] shrink-0"
      />
      <span className="min-w-0">
        <span className="block text-[13px]" style={{ color: "var(--dash-text)" }}>{label}</span>
        {hint && <span className="block text-[11px] mt-0.5" style={{ color: "var(--dash-muted)" }}>{hint}</span>}
      </span>
    </label>
  );
}
