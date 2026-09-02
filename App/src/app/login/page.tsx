"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogInIcon, SparklesIcon } from "lucide-react";
import { useClerk, useSignIn, useSignUp } from "@clerk/nextjs";
import { friendlyClerkError } from "@/lib/clerk-errors";
import {
  AuthBrand,
  AuthField,
  AuthFoot,
  AuthHead,
  AuthInput,
  AuthPassword,
  AuthSplit,
} from "@/components/ui/sign-in";

const ALASAN: Record<string, string> = {
  "bukan-staf": "Akun ini belum terhubung ke kafe mana pun. Hubungi pemilik kafe untuk diundang.",
  nonaktif: "Akses akun ini sedang dinonaktifkan. Hubungi pemilik kafe.",
};

const SIGNUP_FIELD_LABELS: Record<string, string> = {
  email_address: "email",
  first_name: "nama depan",
  last_name: "nama belakang",
  legal_accepted: "persetujuan ketentuan",
  username: "username",
};

const INGAT_KEY = "login-ingat-email";

/* Akses cepat demo. Kredensialnya sengaja publik (NEXT_PUBLIC_*): gunanya
   memang dibagikan, dan menaruhnya di server tidak menambah keamanan apa pun
   ketika halaman ini juga menampilkannya. Panel hanya muncul bila keduanya
   terisi — kalau kosong, tidak ada kontrol yang digambar.

   Jalur masuknya SAMA dengan login biasa (Clerk password sign-in). Tidak ada
   pintu belakang: akun demo tetap akun sungguhan dengan peran dan kafenya
   sendiri, jadi mencabutnya cukup lewat Clerk. */
const DEMO_EMAIL = process.env.NEXT_PUBLIC_DEMO_EMAIL ?? "";
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? "";
const DEMO_AKTIF = Boolean(DEMO_EMAIL && DEMO_PASSWORD);

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

function ClerkSetupPage() {
  return (
    <AuthSplit>
      <AuthBrand />
      <AuthHead title="Clerk belum dikonfigurasi">
        Tambahkan publishable key Clerk di environment lokal untuk mengaktifkan login 3Diner.
      </AuthHead>
      <div className="au-fields">
        <p className="au-note" role="status">
          Isi <b>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</b> dan <b>CLERK_SECRET_KEY</b> dari Clerk
          Dashboard, lalu jalankan ulang server Next.js.
        </p>
      </div>
    </AuthSplit>
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
  const clerk = useClerk();
  const { signOut } = clerk;
  const [mode, setMode] = useState<Mode>("login");

  // State masuk.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  // State daftar.
  const [sEmail, setSEmail] = useState("");
  const [sUsername, setSUsername] = useState("");
  const [sUsernameEdited, setSUsernameEdited] = useState(false);
  const [sPassword, setSPassword] = useState("");
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
    await masuk(email, password);
  }

  /** Satu jalur masuk untuk formulir maupun tombol demo. Tombol demo hanya
   *  mengisi kolom lalu memanggil fungsi yang sama, jadi tidak ada cabang
   *  autentikasi kedua yang perlu diamankan terpisah. */
  async function masuk(identifierMentah: string, kataSandi: string) {
    if (!signIn) {
      setError("Layanan login belum siap. Periksa koneksi lalu coba lagi.");
      return;
    }
    setError("");
    setNote("");
    setLoading(true);
    let waitingForClerk = false;

    try {
      const identifier = identifierMentah.trim();
      try {
        if (remember) window.localStorage.setItem(INGAT_KEY, identifier);
        else window.localStorage.removeItem(INGAT_KEY);
      } catch {
        /* storage penuh/terkunci — fitur ingat boleh gagal diam. */
      }

      const result = await withAuthTimeout(
        signIn.password({ emailAddress: identifier, password: kataSandi }),
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

  /** Masuk demo tanpa langkah verifikasi.
   *
   *  Instance Clerk ini memverifikasi perangkat baru, dan setiap pengunjung
   *  demo datang dari perangkat baru — jalur password akan selalu berhenti di
   *  "masukkan kode yang dikirim ke email", padahal kotak masuk demo tidak
   *  dipegang siapa pun. Jadi server menandatangani sign-in token untuk akun
   *  demo saja, dan di sini ia ditukar langsung menjadi sesi.
   *
   *  Kalau tiketnya gagal (route mati, akun belum di-seed), jalur password
   *  tetap dicoba: lebih baik berhenti di layar verifikasi yang jujur
   *  daripada tombol yang diam. */
  async function masukDemo() {
    if (!DEMO_AKTIF) return;
    setError("");
    setNote("");
    setLoading(true);
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);

    try {
      const res = await fetch("/api/auth/demo-ticket", {
        method: "POST",
        credentials: "same-origin",
      });
      const data = (await res.json().catch(() => ({}))) as { ticket?: string; error?: string };
      if (!res.ok || !data.ticket) throw new Error(data.error ?? "Tiket demo tidak tersedia.");

      const tiket = await clerk.client.signIn.create({ strategy: "ticket", ticket: data.ticket });
      if (tiket.status === "complete" && tiket.createdSessionId) {
        await clerk.setActive({ session: tiket.createdSessionId });
        // Navigasi penuh, bukan router.replace: cookie sesi yang dibaca server
        // dicetak oleh handshake middleware Clerk, dan hanya navigasi tingkat
        // atas yang menjalankannya.
        window.location.assign("/dashboard-v2");
        return;
      }
      throw new Error("Sesi demo belum selesai dibuat.");
    } catch {
      await masuk(DEMO_EMAIL, DEMO_PASSWORD);
    } finally {
      setLoading(false);
    }
  }

  const signupReady =
    /^\S+@\S+\.\S+$/.test(sEmail.trim()) &&
    Boolean(sUsername.trim()) &&
    sPassword.length >= 8 &&
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
            full_name: sEmail.trim().split("@")[0],
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
    <AuthSplit>
      <AuthBrand />

      {!verificationMode && (
        <div
          className="au-tabs au-el"
          style={{ "--d": 1 } as React.CSSProperties}
          role="tablist"
          aria-label="Masuk atau daftar"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            className="au-tab"
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
            className="au-tab"
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
          <AuthHead title="Verifikasi email" delay={2}>
            Masukkan kode yang dikirim ke{" "}
            <b>{verificationMode === "signup" ? sEmail.trim() : email.trim()}</b>.
          </AuthHead>

          <form onSubmit={handleVerification} className="au-fields" noValidate>
            {note && (
              <p className="au-note au-el" style={{ "--d": 3 } as React.CSSProperties} aria-live="polite">
                {note}
              </p>
            )}

            <AuthField label="Kode verifikasi" htmlFor="verification-code" required delay={4}>
              <AuthInput
                id="verification-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="Masukkan kode"
              />
            </AuthField>

            {(error || sError) && (
              <p className="au-alert" role="alert">
                {error || sError}
              </p>
            )}

            <button
              type="submit"
              disabled={!verificationCode.trim() || verifying}
              className="au-submit au-el"
              style={{ "--d": 5 } as React.CSSProperties}
            >
              {verifying ? "Memverifikasi..." : "Verifikasi"}
            </button>
          </form>

          <AuthFoot>
            Kode tidak masuk?{" "}
            <button type="button" className="au-link" onClick={resetVerification}>
              Kembali
            </button>
          </AuthFoot>
        </>
      ) : mode === "login" ? (
        <>
          <AuthHead title="Hai, selamat datang kembali!" delay={2}>
            Masuk untuk mengelola menu, pesanan, dan stok kafe kamu.
          </AuthHead>

          <form onSubmit={handleLogin} className="au-fields" noValidate>
            <AuthField label="Email" htmlFor="email" required delay={3}>
              <AuthInput
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="kamu@kafe.com"
              />
            </AuthField>

            <AuthField label="Password" htmlFor="password" required delay={4}>
              <AuthPassword
                id="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
              />
            </AuthField>

            <div className="au-row au-el" style={{ "--d": 5 } as React.CSSProperties}>
              <label className="au-check">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                Ingat email saya
              </label>
              <button
                type="button"
                className="au-link"
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
              <p className="au-note" aria-live="polite">
                {note}
              </p>
            )}

            {error && (
              <p className="au-alert" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="au-submit au-el"
              style={{ "--d": 6 } as React.CSSProperties}
            >
              {loading ? "Memproses..." : "Masuk"}
              {!loading && <LogInIcon size={16} aria-hidden="true" />}
            </button>
          </form>

            {DEMO_AKTIF && (
              <div className="au-demo au-el" style={{ "--d": 7 } as React.CSSProperties}>
                <p className="au-demo-head">
                  <SparklesIcon size={14} aria-hidden="true" />
                  Coba tanpa akun
                </p>
                <p className="au-demo-body">
                  Masuk sekali klik, tanpa verifikasi email. Isinya kafe contoh — perubahan yang
                  kamu lakukan hanya menyentuh kafe demo itu, bukan kafe sungguhan.
                </p>
                <dl className="au-demo-kv">
                  <div>
                    <dt>Email</dt>
                    <dd>{DEMO_EMAIL}</dd>
                  </div>
                  <div>
                    <dt>Password</dt>
                    <dd>{DEMO_PASSWORD}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  className="au-ghost"
                  disabled={loading}
                  onClick={() => void masukDemo()}
                >
                  {loading ? "Memproses..." : "Masuk sebagai demo"}
                </button>
              </div>
            )}

          <AuthFoot>
            Belum punya akun?{" "}
            <button type="button" className="au-link" onClick={() => setMode("daftar")}>
              Daftar
            </button>
          </AuthFoot>
        </>
      ) : (
        <>
          <AuthHead title="Daftar akun" delay={2}>
            Buat akun untuk mulai mengelola kafe kamu.
          </AuthHead>

          <form onSubmit={handleSignup} className="au-fields" noValidate>
            <AuthField label="Email" htmlFor="s-email" required delay={3}>
              <AuthInput
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
                placeholder="kamu@kafe.com"
              />
            </AuthField>

            <AuthField
              label="Username"
              htmlFor="s-username"
              required
              delay={4}
              hint="Terisi otomatis dari email; ubah kalau mau nama lain."
            >
              <AuthInput
                id="s-username"
                type="text"
                required
                autoComplete="username"
                value={sUsername}
                onChange={(e) => {
                  setSUsernameEdited(true);
                  setSUsername(e.target.value);
                }}
                placeholder="nama_kafe"
              />
            </AuthField>

            <AuthField label="Password" htmlFor="s-password" required delay={5}>
              <AuthPassword
                id="s-password"
                required
                minLength={8}
                autoComplete="new-password"
                value={sPassword}
                onChange={(e) => setSPassword(e.target.value)}
                placeholder="Minimal 8 karakter"
              />
            </AuthField>

            <label className="au-check au-el" style={{ "--d": 6 } as React.CSSProperties}>
              <input type="checkbox" checked={setuju} onChange={(e) => setSetuju(e.target.checked)} />
              <span>
                Dengan mendaftar, saya menyatakan telah membaca dan menyetujui Ketentuan Layanan
                &amp; Kebijakan Privasi 3Diner.
              </span>
            </label>

            {sError && (
              <p className="au-alert" role="alert">
                {sError}
              </p>
            )}

            {ok && (
              <div className="au-ok" role="status">
                Akun untuk <b>{ok.email}</b> berhasil dibuat. {ok.message}
              </div>
            )}

            <button
              type="submit"
              disabled={!signupReady || signingUp}
              className="au-submit au-el"
              style={{ "--d": 7 } as React.CSSProperties}
            >
              {signingUp ? "Mendaftarkan..." : "Daftar"}
            </button>
          </form>

          <AuthFoot>
            Sudah punya akun?{" "}
            <button type="button" className="au-link" onClick={() => setMode("login")}>
              Masuk
            </button>
          </AuthFoot>
        </>
      )}
    </AuthSplit>
  );
}
