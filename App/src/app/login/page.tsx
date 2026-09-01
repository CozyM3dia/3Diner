"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { EyeIcon, EyeOffIcon, LogInIcon } from "lucide-react";
import { useClerk, useSignIn, useSignUp } from "@clerk/nextjs";
import { friendlyClerkError } from "@/lib/clerk-errors";

const ALASAN: Record<string, string> = {
  "bukan-staf": "Akun ini belum terhubung ke kafe mana pun. Hubungi pemilik kafe untuk diundang.",
  nonaktif: "Akses akun ini sedang dinonaktifkan. Hubungi pemilik kafe.",
};

const SIGNUP_FIELD_LABELS: Record<string, string> = {
  email_address: "email",
  first_name: "nama depan",
  last_name: "nama belakang",
  legal_accepted: "persetujuan ketentuan",
  phone_number: "nomor WhatsApp",
  username: "username",
};

const INGAT_KEY = "login-ingat-email";

type Mode = "login" | "daftar";
type VerificationMode = "signin" | "signup";
type AuthFlow = "login" | "signup";
type SignupOk = { email: string; message: string };
type BootstrapResponse = {
  home?: string | null;
  reason?: string | null;
  error?: string;
};

const AUTH_REQUEST_TIMEOUT_MS = 8_000;

class AuthRequestTimeoutError extends Error {
  constructor() {
    super("AUTH_REQUEST_TIMEOUT");
    this.name = "AuthRequestTimeoutError";
  }
}

function withAuthTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => reject(new AuthRequestTimeoutError()), AUTH_REQUEST_TIMEOUT_MS);
    promise.then(
      (value) => {
        globalThis.clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        globalThis.clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

function signupRequirementsMessage(signUp: {
  missingFields: readonly string[];
  unverifiedFields: readonly string[];
}, fallbackError: unknown): string {
  const fields = [...signUp.missingFields, ...signUp.unverifiedFields]
    .filter((field, index, allFields) => allFields.indexOf(field) === index)
    .map((field) => SIGNUP_FIELD_LABELS[field] ?? field)
    .join(", ");

  if (fields) {
    return `Pendaftaran masih memerlukan ${fields}. Lengkapi data tersebut lalu coba lagi.`;
  }

  return friendlyClerkError(fallbackError, "signup");
}

function suggestedUsername(email: string): string {
  const localPart = email.split("@", 1)[0] ?? "";
  const normalized = localPart
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || "pengguna";
}

function LoginLogo() {
  return (
    <div className="login-logo">
      <Image src="/brand/logo-3diner-mark.svg" alt="" width={38} height={38} priority />
      <span>3Diner</span>
    </div>
  );
}

function BrandPanel() {
  return (
    <section className="login-right" aria-hidden="true">
      <span className="login-orbit o1" />
      <span className="login-orbit o2" />
      <span className="login-glow" />

      <p className="login-kicker">Smart Menu · 3D &amp; AR</p>
      <h2 className="login-headline">
        Kendali penuh kafe kamu, dengan menu yang bisa dilihat tamu dalam 3D.
      </h2>
      <p className="login-rightsub">
        Kelola menu, varian, resep, dan stok dari satu konsol — lengkap dengan model 3D
        dan pratinjau AR untuk setiap hidangan.
      </p>

      <div className="login-glass">
        <div className="login-glass-row">
          <span className="login-thumb" />
          <div>
            <span className="login-glass-name">Grilled Salmon Steak</span>
            <span className="login-glass-meta">Rp 48.000 · Tayang terjadwal</span>
          </div>
        </div>
        <div className="login-pills">
          <span className="dv2-pill" style={{ "--pill": "var(--semantic-teal)" } as React.CSSProperties}>
            3D ready
          </span>
          <span className="dv2-pill" style={{ "--pill": "var(--semantic-success)" } as React.CSSProperties}>
            AR ready
          </span>
        </div>
        <p className="login-glass-cap">
          Contoh kartu menu dengan model 3D — tamu memutar hidangan sebelum memesan.
        </p>
      </div>

      <div className="login-figure" />
    </section>
  );
}

function ClerkSetupPage() {
  return (
    <main className="login-split">
      <section className="login-left">
        <LoginLogo />
        <h1 className="login-hello">Clerk belum dikonfigurasi</h1>
        <p className="login-sub">
          Tambahkan publishable key Clerk di environment lokal untuk mengaktifkan login 3Diner.
        </p>
        <div className="login-note" role="status">
          Isi <b>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</b> dan <b>CLERK_SECRET_KEY</b> dari Clerk
          Dashboard, lalu jalankan ulang server Next.js.
        </div>
      </section>
      <BrandPanel />
    </main>
  );
}

export default function LoginPage() {
  // Hooks Clerk harus hanya dirender ketika ClerkProvider sudah aktif. Ini juga
  // memberi pesan setup yang jelas di localhost yang belum memiliki key.
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return <ClerkSetupPage />;
  return <ClerkLoginForm />;
}

function ClerkLoginForm() {
  const router = useRouter();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const { signOut } = useClerk();
  const [mode, setMode] = useState<Mode>("login");

  // State masuk.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  // State daftar.
  const [sEmail, setSEmail] = useState("");
  const [sUsername, setSUsername] = useState("");
  const [sUsernameEdited, setSUsernameEdited] = useState(false);
  const [sPassword, setSPassword] = useState("");
  const [sShowPw, setSShowPw] = useState(false);
  const [wa, setWa] = useState("");
  const [refOpen, setRefOpen] = useState(false);
  const [referral, setReferral] = useState("");
  const [setuju, setSetuju] = useState(false);
  const [sError, setSError] = useState("");
  const [ok, setOk] = useState<SignupOk | null>(null);
  const [signingUp, setSigningUp] = useState(false);

  // State verifikasi email / MFA.
  const [verificationMode, setVerificationMode] = useState<VerificationMode | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [awaitingSignInResolution, setAwaitingSignInResolution] = useState(false);

  // Prefill "Ingat email saya" — localStorage adalah sistem eksternal yang
  // tidak ada saat SSR; sinkronisasi sekali pasca-mount memang lewat effect.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(INGAT_KEY);
      if (saved) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- sinkronisasi satu kali dari storage browser
        setEmail(saved);
        setRemember(true);
      }
    } catch {
      /* storage terkunci (private mode) — fitur ingat boleh gagal diam. */
    }
  }, []);

  // A console layout can send someone back here with `?alasan=`: the account is
  // authenticated but has no staff row, or is deactivated. Reading it from
  // `location` rather than `useSearchParams` keeps this page out of a Suspense
  // boundary. The session is ended so the proxy stops forwarding it to a
  // console that will only reject it again.
  useEffect(() => {
    const alasan = new URLSearchParams(window.location.search).get("alasan");
    if (!alasan) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sinkronisasi satu kali dari URL
    setError(ALASAN[alasan] ?? "Akun belum dapat melanjutkan ke konsol 3Diner.");
    void signOut(() => {});
    window.history.replaceState(null, "", "/login");
  }, [signOut]);

  async function clearClerkSession() {
    try {
      // The callback form suppresses Clerk's default post-sign-out redirect.
      // Without it the browser leaves for `afterSignOutUrl` ("/"), which this
      // app forwards to the public menu — and the reason the session was
      // rejected never reaches the person who needs to read it.
      await withAuthTimeout(signOut(() => {}));
    } catch {
      /* Sesi sudah tidak dapat dipakai; pesan utama tetap ditampilkan. */
    }
  }

  async function finishLogin(flow: AuthFlow): Promise<boolean> {
    let response: Response;
    let data: BootstrapResponse = {};
    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => controller.abort(), AUTH_REQUEST_TIMEOUT_MS);

    try {
      response = await fetch("/api/auth/bootstrap", {
        method: "POST",
        credentials: "same-origin",
        signal: controller.signal,
      });
      data = (await response.json().catch(() => ({}))) as BootstrapResponse;
    } catch (caughtError) {
      const message = isAbortError(caughtError)
        ? "Pemeriksaan sesi terlalu lama. Coba lagi."
        : "Gagal menghubungi server. Coba lagi.";
      if (flow === "login") setError(message);
      else setSError(message);
      return false;
    } finally {
      globalThis.clearTimeout(timeoutId);
    }

    if (response.ok && data.home) {
      router.replace(data.home);
      router.refresh();
      return true;
    }

    // A new Clerk account is valid but has no Staff row yet. End the session so
    // middleware cannot bounce the user between /login and /dashboard.
    if (flow === "signup" && data.reason === "bukan-staf") {
      await clearClerkSession();
      setVerificationMode(null);
      setVerificationCode("");
      setOk({
        email: sEmail.trim(),
        message: "Akun berhasil dibuat, tetapi belum terhubung ke kafe. Hubungi pemilik kafe untuk diundang.",
      });
      setSError("");
      return false;
    }

    // Keep the session for a transient bridge/database failure so the user can
    // retry. Permanent authorization failures are signed out deliberately.
    if (data.reason !== "gagal-muat") await clearClerkSession();

    const message = data.reason
      ? ALASAN[data.reason] ?? "Akun belum dapat melanjutkan ke konsol 3Diner."
      : data.error ?? "Gagal menyiapkan sesi akun. Coba lagi.";
    if (flow === "login") setError(message);
    else setSError(message);
    return false;
  }

  const continuePendingSignIn = useCallback(async (currentSignIn: NonNullable<typeof signIn>) => {
    setLoading(true);

    try {
      if (currentSignIn.status === "complete") {
        const finalized = await withAuthTimeout(
          currentSignIn.finalize({
            navigate: async () => {
              // A full page load, not router.replace: the session cookie the
              // server reads is minted by the Clerk middleware handshake, and
              // only a top-level navigation can run it. Anything issued from
              // the page before that — a bootstrap fetch, an RSC request — is
              // still anonymous and comes back 401.
              //
              // /dashboard-v2 is the entry for every role, not just owners:
              // its layout forwards a cashier to /kasir and sends an account
              // with no Staff row to /login?alasan=bukan-staf, which the proxy
              // leaves alone. That is what keeps this off a redirect loop.
              window.location.assign("/dashboard-v2");
            },
          }),
        );
        if (finalized.error) setError(friendlyClerkError(finalized.error, "signin"));
        return;
      }

      if (currentSignIn.status === "needs_second_factor" || currentSignIn.status === "needs_client_trust") {
        const emailFactor = currentSignIn.supportedSecondFactors.some(
          (factor) => factor.strategy === "email_code",
        );
        if (!emailFactor) {
          setError("Akun ini memerlukan verifikasi tambahan yang belum tersedia di halaman ini.");
          return;
        }

        const code = await withAuthTimeout(currentSignIn.mfa.sendEmailCode());
        if (code.error) {
          setError(friendlyClerkError(code.error, "signin"));
          return;
        }
        setVerificationCode("");
        setVerificationMode("signin");
        setNote("Kode verifikasi tambahan sudah dikirim ke email akunmu.");
        return;
      }

      setError("Metode login ini belum dapat diselesaikan. Coba lagi atau hubungi admin.");
    } catch (caughtError) {
      setError(
        caughtError instanceof AuthRequestTimeoutError
          ? "Pemeriksaan login terlalu lama. Coba lagi."
          : friendlyClerkError(caughtError, "signin"),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!awaitingSignInResolution) return;

    const timeoutId = globalThis.setTimeout(() => {
      setAwaitingSignInResolution(false);
      setLoading(false);
      setError("Login belum menerima respons dari Clerk. Coba lagi.");
    }, AUTH_REQUEST_TIMEOUT_MS);

    if (!signIn || signIn.status === "needs_first_factor") {
      return () => globalThis.clearTimeout(timeoutId);
    }

    const transitionId = globalThis.setTimeout(() => {
      setAwaitingSignInResolution(false);
      void continuePendingSignIn(signIn);
    }, 0);

    return () => {
      globalThis.clearTimeout(timeoutId);
      globalThis.clearTimeout(transitionId);
    };
  }, [awaitingSignInResolution, continuePendingSignIn, signIn]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!signIn) {
      setError("Layanan login belum siap. Periksa koneksi lalu coba lagi.");
      return;
    }
    setError("");
    setNote("");
    setLoading(true);
    let waitingForClerk = false;

    try {
      const identifier = email.trim();
      try {
        if (remember) window.localStorage.setItem(INGAT_KEY, identifier);
        else window.localStorage.removeItem(INGAT_KEY);
      } catch {
        /* storage penuh/terkunci — fitur ingat boleh gagal diam. */
      }

      const result = await withAuthTimeout(
        signIn.password({ emailAddress: identifier, password }),
      );
      if (result.error) {
        setError(friendlyClerkError(result.error, "signin"));
        return;
      }

      waitingForClerk = true;
      setAwaitingSignInResolution(true);
    } catch (caughtError) {
      setError(
        caughtError instanceof AuthRequestTimeoutError
          ? "Pemeriksaan login terlalu lama. Coba lagi."
          : friendlyClerkError(caughtError, "signin"),
      );
    } finally {
      if (!waitingForClerk) setLoading(false);
    }
  }

  function waDigits() {
    return wa.replace(/\D/g, "");
  }

  const signupReady =
    /^\S+@\S+\.\S+$/.test(sEmail.trim()) &&
    Boolean(sUsername.trim()) &&
    sPassword.length >= 8 &&
    waDigits().length >= 9 &&
    setuju;

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!signupReady || !signUp) return;
    setSError("");
    setNote("");
    setOk(null);
    setSigningUp(true);

    try {
      const result = await withAuthTimeout(
        signUp.password({
          emailAddress: sEmail.trim(),
          username: sUsername.trim(),
          password: sPassword,
          legalAccepted: true,
          unsafeMetadata: {
            whatsapp: wa.trim(),
            full_name: sEmail.trim().split("@")[0],
            referral_code: referral.trim() || null,
          },
        }),
      );

      if (result.error) {
        setSError(friendlyClerkError(result.error, "signup"));
        return;
      }

      if (signUp.status === "complete") {
        const finalized = await withAuthTimeout(signUp.finalize());
        if (finalized.error) {
          setSError(friendlyClerkError(finalized.error, "signup"));
          return;
        }
        await finishLogin("signup");
        return;
      }

      const verification = await withAuthTimeout(signUp.verifications.sendEmailCode());
      if (verification.error) {
        setSError(friendlyClerkError(verification.error, "signup"));
        return;
      }
      setVerificationCode("");
      setVerificationMode("signup");
      setNote(`Kode verifikasi sudah dikirim ke ${sEmail.trim()}.`);
    } catch (caughtError) {
      setSError(
        caughtError instanceof AuthRequestTimeoutError
          ? "Pemeriksaan pendaftaran terlalu lama. Coba lagi."
          : friendlyClerkError(caughtError, "signup"),
      );
    } finally {
      setSigningUp(false);
    }
  }

  async function handleVerification(e: React.FormEvent) {
    e.preventDefault();
    const code = verificationCode.trim();
    if (!code || !verificationMode) return;
    setError("");
    setSError("");
    setVerifying(true);

    try {
      if (verificationMode === "signin") {
        if (!signIn) return;
        const result = await withAuthTimeout(signIn.mfa.verifyEmailCode({ code }));
        if (result.error) {
        setError(friendlyClerkError(result.error, "signin"));
          return;
        }
        setAwaitingSignInResolution(true);
        return;
      }

      if (!signUp) return;
      const result = await withAuthTimeout(signUp.verifications.verifyEmailCode({ code }));
      if (result.error) {
        setSError(friendlyClerkError(result.error, "signup"));
        return;
      }

      // Finalize directly after Clerk accepts the code. The Future API updates
      // the resource snapshot asynchronously, so checking status here can
      // reject a valid verification before the new snapshot is available.
      const finalized = await withAuthTimeout(signUp.finalize());
      if (finalized.error) {
        setSError(signupRequirementsMessage(signUp, finalized.error));
        return;
      }
      await finishLogin("signup");
    } catch (caughtError) {
      const message =
        caughtError instanceof AuthRequestTimeoutError
          ? "Pemeriksaan verifikasi terlalu lama. Coba lagi."
          : friendlyClerkError(
              caughtError,
              verificationMode === "signin" ? "signin" : "signup",
            );
      if (verificationMode === "signin") setError(message);
      else setSError(message);
    } finally {
      setVerifying(false);
    }
  }

  async function resetVerification() {
    try {
      if (verificationMode === "signin") await signIn?.reset();
      else if (verificationMode === "signup") await signUp?.reset();
    } finally {
      setVerificationMode(null);
      setVerificationCode("");
      setError("");
      setSError("");
      setNote("");
    }
  }

  return (
    <main className="login-split">
      <section className="login-left">
        <LoginLogo />

        {!verificationMode && (
          <div className="login-tabs" role="tablist" aria-label="Masuk atau daftar">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              className="login-tab"
              onClick={() => {
                setMode("login");
                setError("");
                setSError("");
                setOk(null);
              }}
            >
              Masuk
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "daftar"}
              className="login-tab"
              onClick={() => {
                setMode("daftar");
                setError("");
                setSError("");
                setOk(null);
              }}
            >
              Daftar
            </button>
          </div>
        )}

        {verificationMode ? (
          <>
            <h1 className="login-hello">Verifikasi email</h1>
            <p className="login-sub">
              Masukkan kode yang dikirim ke {verificationMode === "signup" ? sEmail.trim() : email.trim()}.
            </p>

            {note && (
              <p className="login-note" aria-live="polite">
                {note}
              </p>
            )}

            <form onSubmit={handleVerification} className="login-form" noValidate>
              <div className="login-field">
                <label className="login-label" htmlFor="verification-code">
                  Kode verifikasi <span className="req">*</span>
                </label>
                <input
                  id="verification-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  className="login-input"
                  placeholder="Masukkan kode"
                />
              </div>

              {(error || sError) && (
                <p className="login-alert" role="alert">
                  {error || sError}
                </p>
              )}

              <button type="submit" disabled={!verificationCode.trim() || verifying} className="login-submit">
                {verifying ? "Memverifikasi..." : "Verifikasi"}
              </button>
            </form>

            <p className="login-foot">
              Kode tidak masuk?{" "}
              <button type="button" className="login-link" onClick={resetVerification}>
                Kembali
              </button>
            </p>
          </>
        ) : mode === "login" ? (
          <>
            <h1 className="login-hello">Hai, selamat datang kembali!</h1>
            <p className="login-sub">Masuk untuk mengelola menu, pesanan, dan stok kafe kamu.</p>

            <form onSubmit={handleLogin} className="login-form" noValidate>
              <div className="login-field">
                <label className="login-label" htmlFor="email">
                  Email <span className="req">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="login-input"
                  placeholder="kamu@kafe.com"
                />
              </div>

              <div className="login-field">
                <label className="login-label" htmlFor="password">
                  Password <span className="req">*</span>
                </label>
                <div className="login-input-wrap">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="login-input"
                    placeholder="********"
                  />
                  <button
                    type="button"
                    className="login-eye"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  >
                    {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                  </button>
                </div>
              </div>

              <div className="login-row">
                <label className="login-check">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  Ingat email saya
                </label>
                <button
                  type="button"
                  className="login-link"
                  onClick={() =>
                    setNote(
                      "Reset password tersedia setelah konfigurasi email recovery di Clerk Dashboard.",
                    )
                  }
                >
                  Lupa password?
                </button>
              </div>

              {note && (
                <p className="login-note" aria-live="polite">
                  {note}
                </p>
              )}

              {error && (
                <p className="login-alert" role="alert">
                  {error}
                </p>
              )}

              <button type="submit" disabled={loading} className="login-submit">
                {loading ? "Memproses..." : "Masuk"}
                {!loading && <LogInIcon size={16} aria-hidden="true" />}
              </button>
            </form>

            <p className="login-foot">
              Belum punya akun?{" "}
              <button type="button" className="login-link" onClick={() => setMode("daftar")}>
                Daftar
              </button>
            </p>
          </>
        ) : (
          <>
            <h1 className="login-hello">Daftar Akun</h1>
            <p className="login-sub">Buat akun untuk mulai mengelola kafe kamu.</p>

            <form onSubmit={handleSignup} className="login-form" noValidate>
              <div className="login-field">
                <label className="login-label" htmlFor="s-email">
                  Email <span className="req">*</span>
                </label>
                <input
                  id="s-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={sEmail}
                  onChange={(e) => {
                    const nextEmail = e.target.value;
                    setSEmail(nextEmail);
                    if (!sUsernameEdited) setSUsername(suggestedUsername(nextEmail));
                  }}
                  className="login-input"
                  placeholder="Contoh: kamu@kafe.com"
                />
              </div>

              <div className="login-field">
                <label className="login-label" htmlFor="s-username">
                  Username <span className="req">*</span>
                </label>
                <input
                  id="s-username"
                  type="text"
                  required
                  autoComplete="username"
                  value={sUsername}
                  onChange={(e) => {
                    setSUsernameEdited(true);
                    setSUsername(e.target.value);
                  }}
                  className="login-input"
                  placeholder="nama_kafe"
                />
              </div>

              <div className="login-field">
                <label className="login-label" htmlFor="s-password">
                  Password <span className="req">*</span>
                </label>
                <div className="login-input-wrap">
                  <input
                    id="s-password"
                    type={sShowPw ? "text" : "password"}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={sPassword}
                    onChange={(e) => setSPassword(e.target.value)}
                    className="login-input"
                    placeholder="Minimal 8 karakter"
                  />
                  <button
                    type="button"
                    className="login-eye"
                    onClick={() => setSShowPw((s) => !s)}
                    aria-label={sShowPw ? "Sembunyikan password" : "Tampilkan password"}
                  >
                    {sShowPw ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                  </button>
                </div>
              </div>

              <div className="login-field">
                <label className="login-label" htmlFor="s-wa">
                  Nomor WhatsApp <span className="req">*</span>
                </label>
                <div className="signup-wa">
                  <div className="login-input-wrap">
                    <input
                      id="s-wa"
                      type="tel"
                      required
                      inputMode="tel"
                      value={wa}
                      onChange={(e) => setWa(e.target.value)}
                      className="login-input"
                      placeholder="Contoh: 0812 xxxx xxxx"
                    />
                  </div>
                  <button
                    type="button"
                    className="signup-verif"
                    disabled
                    aria-label="Verifikasi nomor WhatsApp — menyusul"
                  >
                    Verifikasi
                  </button>
                </div>
              </div>

              <p className="signup-referral">
                Punya kode referral?{" "}
                <button
                  type="button"
                  className="login-link"
                  onClick={() => setRefOpen((o) => !o)}
                >
                  {refOpen ? "Tutup" : "Gunakan"}
                </button>
              </p>
              {refOpen && (
                <div className="login-field signup-refwrap show">
                  <label className="login-label" htmlFor="s-ref">
                    Kode referral
                  </label>
                  <input
                    id="s-ref"
                    type="text"
                    value={referral}
                    onChange={(e) => setReferral(e.target.value)}
                    className="login-input"
                    placeholder="Masukkan kode referral"
                  />
                </div>
              )}

              <label className="login-check">
                <input
                  type="checkbox"
                  checked={setuju}
                  onChange={(e) => setSetuju(e.target.checked)}
                />
                Dengan mendaftar, saya menyatakan telah membaca dan menyetujui Ketentuan
                Layanan &amp; Kebijakan Privasi 3Diner.
              </label>

              {sError && (
                <p className="login-alert" role="alert">
                  {sError}
                </p>
              )}

              {ok && (
                <div className="signup-ok" role="status">
                  Akun untuk <b>{ok.email}</b> berhasil dibuat. {ok.message}
                </div>
              )}

              <button type="submit" disabled={!signupReady || signingUp} className="login-submit">
                {signingUp ? "Mendaftarkan..." : "Daftar"}
              </button>
            </form>

            <p className="login-foot">
              Sudah punya akun?{" "}
              <button type="button" className="login-link" onClick={() => setMode("login")}>
                Masuk
              </button>
            </p>
          </>
        )}
      </section>

      <BrandPanel />
    </main>
  );
}
