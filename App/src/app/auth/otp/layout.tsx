import type { Metadata } from "next";

export const metadata: Metadata = { title: "OTP | 3Diner" };

// Page /auth/otp adalah client component (timer + perilaku input OTP),
// jadi metadata-nya dijanjakan lewat layout ini.
export default function OtpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
