/* @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  signIn: {
    password: vi.fn(),
    finalize: vi.fn(),
    reset: vi.fn(),
    mfa: {
      sendEmailCode: vi.fn(),
      verifyEmailCode: vi.fn(),
    },
    status: "needs_first_factor" as string,
    supportedSecondFactors: [],
  },
  completedSignIn: {
    password: vi.fn(),
    finalize: vi.fn(),
    reset: vi.fn(),
    mfa: {
      sendEmailCode: vi.fn(),
      verifyEmailCode: vi.fn(),
    },
    status: "complete" as string,
    supportedSecondFactors: [],
  },
  getSignIn: vi.fn(),
  signUp: {
    password: vi.fn(),
    finalize: vi.fn(),
    reset: vi.fn(),
    verifications: {
      sendEmailCode: vi.fn(),
      verifyEmailCode: vi.fn(),
    },
    status: "missing_requirements" as string,
  },
  signOut: vi.fn(),
  assign: vi.fn(),
  router: {
    replace: vi.fn(),
    refresh: vi.fn(),
  },
}));

vi.mock("@clerk/nextjs", () => ({
  useClerk: () => ({ signOut: mocks.signOut }),
  useSignIn: () => ({ signIn: mocks.getSignIn() }),
  useSignUp: () => ({ signUp: mocks.signUp }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => <span data-image={String(props.src ?? "")} />,
}));

import LoginPage from "@/app/login/page";

describe("login authentication flow", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_local";
    mocks.getSignIn.mockReturnValue(mocks.signIn);
    mocks.signIn.password.mockReset();
    mocks.signIn.finalize.mockReset();
    mocks.completedSignIn.finalize.mockReset();
    mocks.signUp.password.mockReset();
    mocks.signUp.finalize.mockReset();
    mocks.signUp.verifications.sendEmailCode.mockReset();
    mocks.signUp.verifications.verifyEmailCode.mockReset();
    mocks.signOut.mockReset();
    mocks.assign.mockReset();
    mocks.router.replace.mockReset();
    mocks.router.refresh.mockReset();
    // jsdom's location is read-only; the sign-in path leaves the page through
    // location.assign, so the spy has to replace the property itself.
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: { ...window.location, assign: mocks.assign, search: "" },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ reason: "bukan-staf" }),
      }),
    );
  });

  it("finalizes signup after email verification even when the status snapshot is stale", async () => {
    mocks.signUp.password.mockResolvedValue({ error: null });
    mocks.signUp.verifications.sendEmailCode.mockResolvedValue({ error: null });
    mocks.signUp.verifications.verifyEmailCode.mockResolvedValue({ error: null });
    mocks.signUp.finalize.mockResolvedValue({ error: null });

    render(<LoginPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Daftar" }));
    fireEvent.change(screen.getByLabelText("Email *"), {
      target: { value: "new@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password *"), {
      target: { value: "local-test-password" },
    });
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /Dengan mendaftar, saya menyatakan telah membaca/i,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^Daftar$/ }));

    await screen.findByRole("textbox", { name: "Kode verifikasi *" });
    fireEvent.change(screen.getByLabelText("Kode verifikasi *"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Verifikasi$/ }));

    await waitFor(() => {
      expect(mocks.signUp.finalize).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText("Data pendaftaran belum lengkap. Kembali dan coba lagi.")).toBeNull();
  });

  it("derives and submits a Clerk username from the signup email", async () => {
    mocks.signUp.password.mockResolvedValue({ error: null });
    mocks.signUp.verifications.sendEmailCode.mockResolvedValue({ error: null });

    render(<LoginPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Daftar" }));
    fireEvent.change(screen.getByLabelText("Email *"), {
      target: { value: "owner.kafe@example.com" },
    });

    const username = screen.getByLabelText("Username *") as HTMLInputElement;
    expect(username.value).toBe("owner_kafe");

    fireEvent.change(screen.getByLabelText("Password *"), {
      target: { value: "local-test-password" },
    });
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /Dengan mendaftar, saya menyatakan telah membaca/i,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^Daftar$/ }));

    await waitFor(() => {
      expect(mocks.signUp.password).toHaveBeenCalledWith(
        expect.objectContaining({ username: "owner_kafe" }),
      );
    });
  });

  it("finishes a password sign-in after Clerk refreshes the sign-in snapshot", async () => {
    mocks.signIn.password.mockImplementation(async () => {
      mocks.getSignIn.mockReturnValue(mocks.completedSignIn);
      return { error: null };
    });
    mocks.completedSignIn.finalize.mockImplementation(async (options: { navigate?: () => Promise<void> }) => {
      await options.navigate?.();
      return { error: null };
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ home: "/dashboard-v2" }),
      }),
    );

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Email *"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password *"), {
      target: { value: "local-test-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Masuk" }));

    await waitFor(() => {
      expect(mocks.completedSignIn.finalize).toHaveBeenCalledTimes(1);
    });
    // A full page load, not router.replace: the session cookie the server
    // reads is minted by the Clerk middleware handshake, which only a
    // top-level navigation can run.
    expect(mocks.assign).toHaveBeenCalledWith("/dashboard-v2");
  });

  it("waits for a later Clerk sign-in update instead of rejecting a pending session", async () => {
    mocks.signIn.password.mockResolvedValue({ error: null });
    mocks.completedSignIn.finalize.mockImplementation(async (options: { navigate?: () => Promise<void> }) => {
      await options.navigate?.();
      return { error: null };
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ home: "/dashboard-v2" }),
      }),
    );

    const view = render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Email *"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password *"), {
      target: { value: "local-test-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Masuk" }));

    await new Promise((resolve) => globalThis.setTimeout(resolve, 650));
    mocks.getSignIn.mockReturnValue(mocks.completedSignIn);
    view.rerender(<LoginPage />);

    await waitFor(() => {
      expect(mocks.completedSignIn.finalize).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("ends the session and explains when a console sends the account back with ?alasan=", async () => {
    // A Clerk account with no Staff row is authenticated but has nowhere to go.
    // The console layout returns it here with a reason, and the proxy leaves
    // that URL alone; ending the session is what stops /login and the console
    // from handing the same person back and forth.
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: { ...window.location, assign: mocks.assign, search: "?alasan=bukan-staf" },
    });

    render(<LoginPage />);

    await waitFor(() => {
      expect(mocks.signOut).toHaveBeenCalled();
    });
    expect(mocks.assign).not.toHaveBeenCalled();
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Akun ini belum terhubung ke kafe mana pun.",
    );
  });

  it("keeps a deactivated account on the login screen with its own message", async () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: { ...window.location, assign: mocks.assign, search: "?alasan=nonaktif" },
    });

    render(<LoginPage />);

    await waitFor(() => {
      expect(mocks.signOut).toHaveBeenCalled();
    });
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Akses akun ini sedang dinonaktifkan.",
    );
  });

  it("shows a missing-account message and releases the loading state", async () => {
    mocks.signIn.password.mockResolvedValue({
      error: { code: "form_identifier_not_found", longMessage: "Couldn't find your account." },
    });

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Email *"), {
      target: { value: "missing@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password *"), {
      target: { value: "local-test-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Masuk" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Akun tidak ditemukan. Silakan daftar terlebih dahulu.");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Masuk" }).hasAttribute("disabled")).toBe(false);
    });
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });

  it("does not show the signup duplicate-email message during sign-in", async () => {
    mocks.signIn.password.mockResolvedValue({
      error: { longMessage: "This email is already registered. Please sign in." },
    });

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Email *"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password *"), {
      target: { value: "local-test-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Masuk" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Email atau password salah.");
    expect(screen.queryByText("Email ini sudah terdaftar. Coba masuk, atau gunakan email lain.")).toBeNull();
  });
});
