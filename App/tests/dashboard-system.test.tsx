// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import StatusBadge, { type StatusKind } from "../src/components/dashboard/system/StatusBadge";
import ResponsiveDataView from "../src/components/dashboard/system/ResponsiveDataView";
import ConfirmAction from "../src/components/dashboard/system/ConfirmAction";

function stubMatchMedia(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const ALL_KINDS: [StatusKind, string][] = [
  ["order-received", "Baru"],
  ["order-preparing", "Diproses"],
  ["order-ready", "Siap"],
  ["pay-cash", "Tunai"],
  ["pay-qris", "QRIS"],
  ["pay-unpaid", "Belum Bayar"],
  ["inv-ready", "Resep aktif"],
  ["inv-low", "Stok kurang"],
  ["inv-none", "Tanpa resep"],
  ["active", "Aktif"],
  ["inactive", "Nonaktif"],
  ["threeD", "3D"],
];

describe("StatusBadge", () => {
  afterEach(cleanup);

  it("maps every kind to a text label plus a non-color-only dot", () => {
    for (const [kind, label] of ALL_KINDS) {
      const { container, unmount } = render(<StatusBadge kind={kind} />);
      expect(container.textContent).toContain(label);
      expect(container.querySelector("span[aria-hidden='true']")).toBeTruthy();
      unmount();
    }
  });

  it("allows label override while keeping kind styling", () => {
    render(<StatusBadge kind="active" label="Tampil" />);
    expect(screen.getByText("Tampil")).toBeTruthy();
  });
});

describe("ResponsiveDataView", () => {
  afterEach(cleanup);

  it("mounts only the table branch on desktop", async () => {
    stubMatchMedia(true);
    render(
      <ResponsiveDataView
        table={(p) => <table aria-label="tabel" id={`${p}-x`} />}
        cards={(p) => <ul aria-label="kartu" id={`${p}-x`} />}
      />
    );
    await waitFor(() => expect(screen.queryByRole("table")).toBeTruthy());
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("mounts only the cards branch on mobile", async () => {
    stubMatchMedia(false);
    render(
      <ResponsiveDataView
        table={(p) => <table aria-label="tabel" id={`${p}-x`} />}
        cards={(p) => <ul aria-label="kartu" id={`${p}-x`} />}
      />
    );
    await waitFor(() => expect(screen.queryByRole("list")).toBeTruthy());
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("namespaces ids so the pre-hydration dual render never duplicates them", () => {
    const ids = new Set<string>();
    render(
      <ResponsiveDataView
        table={(p) => { ids.add(`${p}-row`); return <div id={`${p}-row`} />; }}
        cards={(p) => { ids.add(`${p}-row`); return <div id={`${p}-row`} />; }}
      />
    );
    expect(ids.size).toBe(2);
  });
});

describe("ConfirmAction", () => {
  afterEach(cleanup);

  it("runs onConfirm only after the confirm button, never on cancel", async () => {
    stubMatchMedia(false);
    const onConfirm = vi.fn();
    render(
      <ConfirmAction
        trigger={<button>Hapus</button>}
        title="Hapus menu?"
        description="Tindakan ini tidak bisa dibatalkan."
        confirmLabel="Hapus"
        onConfirm={onConfirm}
        destructive
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Hapus" }));
    const cancel = await screen.findByRole("button", { name: "Batal" });
    fireEvent.click(cancel);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Hapus" }));
    const confirm = await screen.findAllByRole("button", { name: "Hapus" });
    fireEvent.click(confirm[confirm.length - 1]);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
