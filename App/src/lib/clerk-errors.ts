type ClerkErrorItem = {
  code?: unknown;
  longMessage?: unknown;
  message?: unknown;
};

type ClerkErrorLike = ClerkErrorItem & {
  errors?: ClerkErrorItem[];
};

type ClerkErrorContext = "signin" | "signup" | "generic";

function clerkErrorText(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const candidate = error as ClerkErrorLike;
  const details = [
    candidate.code,
    candidate.longMessage,
    candidate.message,
    ...(Array.isArray(candidate.errors)
      ? candidate.errors.flatMap((item) => [item.code, item.longMessage, item.message])
      : []),
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  return [...new Set(details)].join(" ");
}

export function friendlyClerkError(error: unknown, context: ClerkErrorContext = "generic"): string {
  const raw = clerkErrorText(error);
  const lower = raw.toLowerCase();

  if (
    lower.includes("form_identifier_not_found") ||
    lower.includes("identifier_not_found") ||
    lower.includes("user_not_found") ||
    lower.includes("account_not_found") ||
    lower.includes("couldn't find your account") ||
    lower.includes("could not find your account") ||
    lower.includes("not found")
  ) {
    return "Akun tidak ditemukan. Silakan daftar terlebih dahulu.";
  }
  // Checked before the generic "already" branch: retrying a sign-in while a
  // session is live reports session_exists, and reading that as bad
  // credentials sends people off resetting a password that was never wrong.
  if (lower.includes("session_exists") || lower.includes("already signed in")) {
    return "Kamu sudah masuk. Muat ulang halaman untuk melanjutkan.";
  }
  const alreadyRegistered = lower.includes("already") || lower.includes("exist") || lower.includes("taken");
  if (alreadyRegistered) {
    return context === "signin"
      ? "Email atau password salah."
      : "Email ini sudah terdaftar. Coba masuk, atau gunakan email lain.";
  }
  if (
    lower.includes("form_password_incorrect") ||
    lower.includes("password") ||
    lower.includes("credential") ||
    (context !== "signup" && lower.includes("identifier"))
  ) {
    return "Email atau password salah.";
  }
  if (lower.includes("too many") || lower.includes("rate limit")) {
    return "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.";
  }
  if (lower.includes("code") || lower.includes("verification")) {
    return "Kode verifikasi tidak valid atau sudah kedaluwarsa.";
  }
  return raw || "Permintaan autentikasi gagal. Coba lagi.";
}
