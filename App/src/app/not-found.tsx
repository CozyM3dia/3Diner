import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <main
      className="min-h-dvh flex flex-col items-center justify-center px-6 text-center"
      style={{ background: "#FDFDFD" }}
    >
      <Image
        src="/brand/logo-3diner-mark.svg"
        alt="3Diner"
        width={72}
        height={72}
        className="mb-6 opacity-90"
      />

      <h1 className="text-5xl font-bold mb-2" style={{ color: "#022C60" }}>
        404
      </h1>

      <p className="text-lg font-semibold mb-1" style={{ color: "#022C60" }}>
        Kafe tidak ditemukan
      </p>

      <p className="text-sm mb-8" style={{ color: "#51698F" }}>
        Pastikan QR code yang kamu scan sudah benar,
        <br />
        atau kafe ini belum aktif.
      </p>

      <Link
        href="/"
        className="px-6 py-3 rounded-full text-sm font-semibold text-white transition-all active:scale-95"
        style={{ background: "#FD5002" }}
      >
        Kembali ke Beranda
      </Link>
    </main>
  );
}
