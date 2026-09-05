// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import MenuEditorForm from "@/components/dp/MenuEditorForm";

vi.mock("next/image", () => ({
  default: ({ alt = "", ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => {
    const imageProps = { ...props };
    delete imageProps.fill;
    return React.createElement("img", { alt, ...imageProps });
  },
}));

vi.mock("@/components/viewer/GlbViewer", () => ({
  default: () => <div data-testid="glb-viewer" />,
}));

vi.mock("@/lib/dashboard-actions", () => ({
  createMediaUploadUrl: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ storage: { from: vi.fn() } }),
}));

describe("MenuEditorForm action footer", () => {
  afterEach(cleanup);

  it("keeps save and cancel in a collision-safe flow layout at every breakpoint", () => {
    const { container } = render(
      <MenuEditorForm mode="create" categories={[]} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    );

    const footer = container.querySelector(".dp-menuf-foot");
    expect(footer?.getAttribute("data-layout")).toBe("flow");
    const actions = screen.getByRole("group", { name: "Aksi editor menu" });
    expect(actions.contains(screen.getByRole("button", { name: "Batal" }))).toBe(true);
    expect(actions.contains(screen.getByRole("button", { name: "Simpan Menu" }))).toBe(true);

    const css = readFileSync(resolve(process.cwd(), "src/app/menu-editor.css"), "utf8");
    const footerRule = css.match(/\.dp-menuf-foot\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(footerRule).toContain("position: static");
    expect(footerRule).not.toContain("position: fixed");
    expect(footerRule).not.toContain("position: sticky");
    expect(css).toMatch(/@media \(max-width: 640px\)[\s\S]*?\.dp-menuf-actions\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\)/);
    expect(css).toMatch(/padding-bottom: calc\(12px \+ env\(safe-area-inset-bottom\)\)/);
    expect(css).toMatch(/@media \(max-width: 360px\)[\s\S]*?\.dp-menuf-actions\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
  });

  it("preserves the existing cancel and valid-save behavior", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    render(
      <MenuEditorForm mode="create" categories={[]} onSubmit={onSubmit} onCancel={onCancel} />,
    );

    await user.click(screen.getByRole("button", { name: "Batal" }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    await user.type(screen.getByLabelText(/Nama Menu/), "Nasi Goreng");
    fireEvent.change(screen.getByLabelText(/Harga/), { target: { value: "25000" } });
    await user.click(screen.getByRole("button", { name: "Simpan Menu" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      nama_menu: "Nasi Goreng",
      harga_menu: 25000,
    });
  });
});
