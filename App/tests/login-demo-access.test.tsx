/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Panel "Coba tanpa akun" di /login.
 *
 *  Dua hal yang dijaga tes ini, keduanya pernah menjadi cara fitur demo
 *  berubah jadi lubang: panel tidak boleh muncul saat kredensialnya belum
 *  diisi (kalau muncul, ia menawarkan login yang pasti gagal), dan tombolnya
 *  harus menempuh jalur Clerk yang sama dengan formulir biasa — bukan jalur
 *  masuk kedua yang melewati pemeriksaan.
 */

const mocks = vi.hoisted(() => ({
  signIn: {
    password: vi.fn(),
    finalize: vi.fn(),
    reset: vi.fn(),
    mfa: { sendEmailCode: vi.fn(), verifyEmailCode: vi.fn() },
    status: "needs_first_factor" as string,
    supportedSecondFactors: [],
  },
  signUp: {
    password: vi.fn(),
    finalize: vi.fn(),
    reset: vi.fn(),
    verifications: { sendEmailCode: vi.fn(), verifyEmailCode: vi.fn() },
    status: "missing_requirements" as string,
  },
  signOut: vi.fn(),
  router: { replace: vi.fn(), refresh: vi.fn() },
}));

vi.mock("@clerk/nextjs", () => ({
  useClerk: () => ({ signOut: mocks.signOut }),
  useSignIn: () => ({ signIn: mocks.signIn }),
  useSignUp: () => ({ signUp: mocks.signUp }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => <span data-image={String(props.src ?? "")} />,
}));

const DEMO_EMAIL = "demo@3diner.app";
const DEMO_PASSWORD = "demo-3diner-2026";

async function muatHalaman() {
  vi.resetModules();
  const modul = await import("@/app/login/page");
  return modul.default;
}

describe("akses cepat akun demo", () => {
  afterEach(() => {
    cleanup();
    delete process.env.NEXT_PUBLIC_DEMO_EMAIL;
    delete process.env.NEXT_PUBLIC_DEMO_PASSWORD;
  });

  beforeEach(() => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_local";
    mocks.signIn.password.mockReset();
    mocks.signIn.password.mockResolvedValue({ error: null });
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: { ...window.location, assign: vi.fn(), search: "" },
    });
  });

  it("menyembunyikan panel demo saat kredensialnya belum diisi", async () => {
    const LoginPage = await muatHalaman();
    render(<LoginPage />);

    expect(screen.queryByRole("button", { name: /Masuk sebagai demo/i })).toBeNull();
  });

  it("memakai jalur login yang sama dengan formulir biasa", async () => {
    process.env.NEXT_PUBLIC_DEMO_EMAIL = DEMO_EMAIL;
    process.env.NEXT_PUBLIC_DEMO_PASSWORD = DEMO_PASSWORD;

    const LoginPage = await muatHalaman();
    render(<LoginPage />);

    // Kredensial tampil supaya bisa disalin, bukan hanya tersembunyi di tombol.
    expect(screen.getByText(DEMO_EMAIL)).toBeTruthy();
    expect(screen.getByText(DEMO_PASSWORD)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Masuk sebagai demo/i }));

    await waitFor(() => {
      expect(mocks.signIn.password).toHaveBeenCalledWith({
        emailAddress: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      });
    });

    // Kolom ikut terisi: orang yang menekan tombol demo tetap melihat akun
    // mana yang sedang dipakai, bukan formulir kosong yang tiba-tiba masuk.
    expect((screen.getByLabelText("Email *") as HTMLInputElement).value).toBe(DEMO_EMAIL);
  });
});
