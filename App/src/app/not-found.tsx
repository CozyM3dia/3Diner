import Link from "next/link";
import Image from "next/image";
import { QrCode, HelpCircle } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-dvh flex flex-col" style={{ background: "var(--paper)" }}>
      <header className="flex items-center justify-center py-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <Image src="/brand/logo-3diner.png" alt="3Diner" width={120} height={36} className="object-contain h-8 w-auto" priority />
      </header>

      <div className="flex-1 flex flex-col justify-center px-6">
        {/* Composed illustration */}
        <div className="relative w-40 h-40 mx-auto mb-2">
          <div
            className="absolute inset-0 rounded-[28px] flex items-center justify-center"
            style={{ border: "2px solid var(--navy)" }}
          >
            <QrCode size={72} style={{ color: "var(--navy)" }} strokeWidth={1.4} />
          </div>
          <span
            className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full inline-flex items-center justify-center text-white"
            style={{ background: "var(--orange)", boxShadow: "var(--shadow-orange)" }}
          >
            <HelpCircle size={22} strokeWidth={2.5} />
          </span>
        </div>

        <h1 className="font-display text-2xl font-extrabold mt-8" style={{ color: "var(--navy)" }}>
          Cafe Tidak Ditemukan
        </h1>
        <p className="text-sm leading-relaxed mt-3" style={{ color: "var(--navy-muted)" }}>
          Pastikan kamu scan QR yang benar dari meja cafe, atau minta bantuan staff.
        </p>

        <Link
          href="/"
          className="btn-primary press mt-6 h-12 rounded-2xl inline-flex items-center justify-center text-sm font-semibold text-white"
        >
          Kembali ke Beranda
        </Link>
      </div>

      <footer className="text-center pb-8">
        <p className="text-[11px]" style={{ color: "var(--navy-muted)" }}>
          Powered by{" "}
          <span className="font-display font-bold" style={{ color: "var(--orange-ink)" }}>3Diner</span>
        </p>
      </footer>
    </main>
  );
}
