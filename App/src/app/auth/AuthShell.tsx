import Image from "next/image";
import "./auth.css";

/**
 * Shell dua kolom autentikasi — recreation 1:1 markup template Dream POS
 * (col-lg-6 form kiri + col-lg-6 panel promo biru kanan). Konten form
 * diisi tiap halaman; panel kanan identik di semua halaman.
 *
 * Placeholder: semua halaman /auth/* belum punya logic — hanya UI penuh.
 */
export default function AuthShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="ap">
      <div className="ap-wrap">
        <div className="ap-row">
          {/* Kolom kiri: form */}
          <div className="ap-left">
            <div className="ap-left-in">
              <div className="ap-form-col">
                <div className="ap-fcol ap-fcol-p3">
                  <div className="ap-logo">
                    {/* eslint-disable-next-line @next/next/no-img-element -- logo SVG template butuh fill asli */}
                    <img
                      src="/dp-auth/logo.svg"
                      alt="Logo"
                      style={{ display: "block" }}
                    />
                  </div>
                  <div>{children}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Kolom kanan: panel promo */}
          <div className="ap-right">
            <div className="ap-panel">
              <Image
                src="/dp-auth/authentication-bg-01.png"
                alt=""
                fill
                aria-hidden
                className="ap-bg01"
                sizes="(max-width: 991px) 0px, 50vw"
              />
              <Image
                src="/dp-auth/authentication-bg-02.png"
                alt=""
                aria-hidden
                width={428}
                height={256}
                className="ap-bg02"
              />
              <div className="ap-pwrap">
                <div className="ap-ptext">
                  <h1>Complete Control of Your Cafe &amp; Restaurant with Ease</h1>
                  <p>
                    From billing to inventory access everything you need in a
                    single powerful dashboard, Analyze sales, track your
                    best-selling dishes.
                  </p>
                </div>
                <div className="ap-pimg">
                  <Image
                    src="/dp-auth/login.png"
                    alt=""
                    aria-hidden
                    width={554}
                    height={638}
                    priority
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
