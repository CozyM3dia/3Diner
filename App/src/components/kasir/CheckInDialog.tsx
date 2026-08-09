"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { checkInOrder } from "@/lib/kasir-checkin";

interface Props {
  onClose: () => void;
}

/** Minimal BarcodeDetector — belum ada di lib DOM standar TypeScript.
 *  Hanya bagian yang dipakai di sini yang dideklarasikan. */
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

const CODE_RE = /^[A-Z0-9]{8}$/;

/** Kode 8 karakter disaring saat diketik: apa pun selain [A-Z0-9] dibuang dan
 *  hurufnya dinaikkan, jadi kasir tidak bisa mengetik kode yang pasti ditolak. */
function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

/** Membaca payload QR pelanggan: `{"o": orderId, "c": code}` (Task 9).
 *  Hanya kodenya yang dipakai — check-in sekarang bekerja dari kode saja,
 *  `o` diabaikan. QR mentah berupa kode 8-karakter polos juga diterima
 *  langsung, tanpa perlu dibungkus JSON. */
function parseQrPayload(raw: string): string | null {
  const bare = normalizeCode(raw);
  if (CODE_RE.test(bare)) return bare;
  try {
    const data = JSON.parse(raw) as { c?: unknown };
    const c = typeof data.c === "string" ? normalizeCode(data.c) : "";
    if (CODE_RE.test(c)) return c;
  } catch {
    /* Bukan JSON — QR lain yang tidak berkaitan. */
  }
  return null;
}

/** Check-in pesanan bayar-di-kasir.
 *
 *  Jalur utama adalah pindai kamera: QR pelanggan membawa nomor pesanan DAN
 *  kode sekaligus, jadi satu pindaian cukup. Ketik manual adalah cadangan saat
 *  kamera tidak ada atau menolak — kasir menyalin keduanya dari layar tamu.
 *
 *  Kamera diperlakukan sebagai peningkatan bertahap: bila `BarcodeDetector`
 *  tidak ada di perangkat, opsi kamera disembunyikan dan hanya ketik manual
 *  yang tampil. Tugas tidak pernah bergantung pada dukungan kamera. */
export default function CheckInDialog({ onClose }: Props) {
  // null sampai fitur dicek di klien. Server tidak punya BarcodeDetector, jadi
  // mengeceknya di render awal akan berbeda antara server dan klien.
  const [cameraSupported, setCameraSupported] = useState<boolean | null>(null);
  const [mode, setMode] = useState<"scan" | "manual">("manual");

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanNote, setScanNote] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const submittingRef = useRef(false);
  const returnTo = useRef<Element | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const submit = useCallback(
    async (c: string): Promise<boolean> => {
      if (submittingRef.current) return false;
      submittingRef.current = true;
      setBusy(true);
      setError(null);
      const msg = await checkInOrder(c);
      setBusy(false);
      submittingRef.current = false;
      if (msg) {
        setError(msg);
        return false;
      }
      toast.success("Pesanan berhasil di-check-in");
      onClose();
      return true;
    },
    [onClose]
  );

  // Deteksi fitur + kembalikan fokus. Sekali saja saat mount.
  useEffect(() => {
    returnTo.current = document.activeElement;
    closeRef.current?.focus();
    const supported =
      typeof window !== "undefined" &&
      "BarcodeDetector" in window &&
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia;
    setCameraSupported(supported);

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      const el = returnTo.current;
      if (el instanceof HTMLElement) requestAnimationFrame(() => el.focus());
    };
  }, [onClose]);

  // Siklus kamera: hidup hanya selama mode "scan". Berhenti — dan matikan
  // lampu kamera — begitu dialog pindah mode atau ditutup.
  useEffect(() => {
    if (mode !== "scan" || !cameraSupported) return;

    let disposed = false;
    const Ctor = (window as unknown as { BarcodeDetector: BarcodeDetectorCtor }).BarcodeDetector;
    const detector = new Ctor({ formats: ["qr_code"] });

    async function start() {
      setScanNote("Arahkan kamera ke QR pelanggan.");
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (disposed) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        tick();
      } catch {
        // Izin ditolak atau tidak ada kamera: jatuh ke ketik manual, bukan
        // layar kosong yang membuat kasir mengira fiturnya rusak.
        if (disposed) return;
        setScanNote(null);
        setMode("manual");
        setError("Kamera tidak dapat dibuka. Ketik kode secara manual.");
      }
    }

    async function tick() {
      const video = videoRef.current;
      if (disposed || !video || video.readyState < 2) {
        if (!disposed) rafRef.current = requestAnimationFrame(tick);
        return;
      }
      try {
        const found = await detector.detect(video);
        for (const bc of found) {
          const parsed = parseQrPayload(bc.rawValue);
          if (parsed) {
            setScanNote("QR terbaca. Memproses…");
            const ok = await submit(parsed);
            if (!ok && !disposed) {
              // Gagal (mis. stok kurang): berhenti memindai supaya pesannya
              // terbaca, tapi tetap tampilkan tombol pindai lagi.
              setScanNote(null);
              return;
            }
            return;
          }
        }
      } catch {
        /* Satu bingkai gagal didekode bukan kegagalan — coba bingkai berikut. */
      }
      if (!disposed) rafRef.current = requestAnimationFrame(tick);
    }

    start();

    return () => {
      disposed = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [mode, cameraSupported, submit]);

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const c = normalizeCode(code);
    if (!CODE_RE.test(c)) {
      setError("Kode check-in harus 8 karakter (huruf/angka).");
      return;
    }
    void submit(c);
  }

  const showScanToggle = cameraSupported === true;

  return (
    <div className="kasir-overlay" role="presentation" onMouseDown={onClose}>
      <div
        className="kasir-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kasir-checkin-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="kasir-checkin-title" className="kasir-dialog-title">
          Check-in pesanan
        </h2>
        <p className="kasir-dialog-body">
          Pindai QR yang tamu tunjukkan, atau ketik kode check-in-nya. Pesanan masuk ke antrean
          setelah cocok.
        </p>

        {showScanToggle && (
          <div className="kasir-seg" role="tablist" aria-label="Cara check-in">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "scan"}
              className="kasir-seg-btn"
              data-active={mode === "scan" ? "true" : undefined}
              onClick={() => setMode("scan")}
            >
              Pindai QR
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "manual"}
              className="kasir-seg-btn"
              data-active={mode === "manual" ? "true" : undefined}
              onClick={() => setMode("manual")}
            >
              Ketik kode
            </button>
          </div>
        )}

        {mode === "scan" && showScanToggle ? (
          <div className="kasir-scan">
            <video ref={videoRef} className="kasir-scan-video" muted playsInline />
            <div className="kasir-scan-frame" aria-hidden="true" />
            {scanNote && <p className="kasir-scan-note">{scanNote}</p>}
          </div>
        ) : (
          <form onSubmit={submitManual}>
            <label className="kasir-label" htmlFor="kasir-checkin-code">
              Kode check-in
            </label>
            <input
              id="kasir-checkin-code"
              className="kasir-input kasir-input-code"
              value={code}
              onChange={(e) => setCode(normalizeCode(e.target.value))}
              placeholder="8 karakter"
              autoComplete="off"
              autoCapitalize="characters"
              inputMode="text"
              maxLength={8}
              aria-describedby="kasir-checkin-code-hint"
            />
            <p id="kasir-checkin-code-hint" className="kasir-hint">
              Huruf dan angka, 8 karakter. Contoh: 4F7K2Q9P
            </p>

            {error && (
              <p className="kasir-dialog-error" role="alert">
                {error}
              </p>
            )}

            <div className="kasir-dialog-foot">
              <button ref={closeRef} type="button" className="kasir-btn" onClick={onClose} disabled={busy}>
                Batal
              </button>
              <button type="submit" className="kasir-btn kasir-btn-solid" disabled={busy}>
                {busy ? <Loader2 size={13} className="animate-spin" /> : null}
                Check-in
              </button>
            </div>
          </form>
        )}

        {mode === "scan" && showScanToggle && (
          <>
            {error && (
              <p className="kasir-dialog-error" role="alert">
                {error}
              </p>
            )}
            <div className="kasir-dialog-foot">
              <button ref={closeRef} type="button" className="kasir-btn" onClick={onClose} disabled={busy}>
                Batal
              </button>
              {error ? (
                <button
                  type="button"
                  className="kasir-btn kasir-btn-solid"
                  disabled={busy}
                  onClick={() => {
                    // Ulang siklus kamera dengan mem-bounce mode.
                    setError(null);
                    setMode("manual");
                    requestAnimationFrame(() => setMode("scan"));
                  }}
                >
                  Pindai lagi
                </button>
              ) : (
                <span className="kasir-scan-busy" aria-live="polite">
                  {busy ? <Loader2 size={13} className="animate-spin" /> : null}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
