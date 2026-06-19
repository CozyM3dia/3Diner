import Link from "next/link";

export default function NotFound() {
  return (
    <main
      className="min-h-dvh flex flex-col items-center justify-center px-6 text-center"
      style={{ background: "#FDF6EC" }}
    >
      {/* Cup illustration */}
      <div className="text-7xl mb-6 select-none">☕</div>

      <h1
        className="text-5xl font-bold mb-2"
        style={{ fontFamily: "var(--font-playfair)", color: "#8B5E3C" }}
      >
        404
      </h1>

      <p
        className="text-lg font-medium mb-1"
        style={{ color: "#2C1810" }}
      >
        Kafe tidak ditemukan
      </p>

      <p className="text-sm mb-8" style={{ color: "#C4956A" }}>
        Pastikan QR code yang kamu scan sudah benar,
        <br />
        atau kafe ini belum aktif.
      </p>

      <Link
        href="/"
        className="px-6 py-3 rounded-full text-sm font-semibold transition-all active:scale-95"
        style={{
          background: "#8B5E3C",
          color: "#FDF6EC",
        }}
      >
        Kembali ke Beranda
      </Link>
    </main>
  );
}
