/**
 * @vitest-environment jsdom
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MenuEditorForm from "../src/components/dp/MenuEditorForm";
import {
  MAX_FOTO,
  validateMenuModel,
  validateMenuPhoto,
} from "../src/components/dp/menu-editor-upload";

const { createMediaUploadUrl, uploadToSignedUrl } = vi.hoisted(() => ({
  createMediaUploadUrl: vi.fn(),
  uploadToSignedUrl: vi.fn(),
}));

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
  createMediaUploadUrl,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: {
      from: () => ({ uploadToSignedUrl }),
    },
  }),
}));

function png(name = "foto.png", bytes = 64) {
  return new File([new Uint8Array(bytes)], name, { type: "image/png" });
}

function renderForm(onSubmit = vi.fn()) {
  return render(
    <MenuEditorForm
      mode="create"
      categories={["Pastry"]}
      onSubmit={onSubmit}
      onCancel={() => undefined}
    />
  );
}

describe("menu-editor-upload validation", () => {
  it("rejects a non-image with the QA Indonesian copy", () => {
    expect(validateMenuPhoto(new File([new Uint8Array(8)], "notes.txt", { type: "text/plain" }))).toBe(
      "File harus berupa gambar (JPG/PNG/WebP)."
    );
  });

  it("rejects an oversized photo", () => {
    const big = new File([new Uint8Array(MAX_FOTO + 4)], "besar.png", { type: "image/png" });
    expect(validateMenuPhoto(big)).toBe("Ukuran foto maksimal 5MB.");
  });

  it("accepts a .glb even when MIME is empty", () => {
    expect(validateMenuModel(new File([new Uint8Array(8)], "steak.glb", { type: "" }))).toBeNull();
    expect(validateMenuModel(png())).toBe("Format model harus .glb atau .gltf.");
  });
});

describe("MenuEditorForm dropzone", () => {
  beforeEach(() => {
    createMediaUploadUrl.mockReset();
    uploadToSignedUrl.mockReset();
    createMediaUploadUrl.mockResolvedValue({
      path: "cafe/model/1-steak.glb",
      token: "tok",
      publicUrl: "https://cdn.example/steak.glb",
    });
    uploadToSignedUrl.mockResolvedValue({ error: null });
    URL.createObjectURL = vi.fn(() => "blob:menu-photo-preview");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(cleanup);

  it("shows the Indonesian error and does not set photo for the wrong type", async () => {
    const onSubmit = vi.fn();
    renderForm(onSubmit);

    const dropzone = screen.getByText("Tarik foto ke sini atau klik untuk memilih").closest("label");
    fireEvent.drop(dropzone as HTMLElement, {
      dataTransfer: {
        files: [new File([new Uint8Array(8)], "notes.txt", { type: "text/plain" })],
        items: [{ kind: "file" }],
        types: ["Files"],
      },
    });

    expect(screen.getByRole("alert").textContent).toBe("File harus berupa gambar (JPG/PNG/WebP).");
    expect(document.querySelector("img")).toBeNull();

    await userEvent.type(screen.getByLabelText(/Nama Menu/), "Steak");
    fireEvent.change(screen.getByLabelText(/Harga/), { target: { value: "50000" } });
    await userEvent.click(screen.getByRole("button", { name: /Simpan Menu/i }));

    expect(onSubmit).toHaveBeenCalled();
    expect(onSubmit.mock.calls[0][1]).toBeNull();
  });

  it("rejects an oversized photo without keeping it", () => {
    renderForm();
    const dropzone = screen.getByText("Tarik foto ke sini atau klik untuk memilih").closest("label");
    const big = new File([new Uint8Array(MAX_FOTO + 4)], "besar.png", { type: "image/png" });
    fireEvent.drop(dropzone as HTMLElement, {
      dataTransfer: { files: [big], items: [{ kind: "file" }], types: ["Files"] },
    });
    expect(screen.getByRole("alert").textContent).toBe("Ukuran foto maksimal 5MB.");
    expect(document.querySelector("img")).toBeNull();
  });

  it("shows a blob URL image preview for a matching photo", async () => {
    const onSubmit = vi.fn();
    renderForm(onSubmit);

    const input = screen.getByLabelText("Unggah foto menu");
    await userEvent.upload(input, png());

    await waitFor(() => {
      expect(document.querySelector("img")?.getAttribute("src")).toBe("blob:menu-photo-preview");
    });

    await userEvent.type(screen.getByLabelText(/Nama Menu/), "Steak");
    fireEvent.change(screen.getByLabelText(/Harga/), { target: { value: "50000" } });
    await userEvent.click(screen.getByRole("button", { name: /Simpan Menu/i }));

    expect(onSubmit.mock.calls[0][1]).toBeInstanceOf(File);
    expect(onSubmit.mock.calls[0][1].name).toBe("foto.png");
  });

  it("uploads a .glb with empty MIME via the signed menu-media path", async () => {
    renderForm();
    // Dicari di dalam daftar tab EDITOR: pratinjau langsung punya daftar tab
    // sendiri di sebelahnya, dan pencarian global akan menemukan keduanya.
    const tabEditor = screen.getByRole("tablist", { name: "Bagian editor menu" });
    await userEvent.click(within(tabEditor).getByRole("tab", { name: /3D & AR/ }));

    const glb = new File([new Uint8Array(32)], "steak.glb", { type: "" });
    const zone = screen.getByText("Tarik file .glb ke sini").closest("label");
    fireEvent.drop(zone as HTMLElement, {
      dataTransfer: { files: [glb], items: [{ kind: "file" }], types: ["Files"] },
    });

    await waitFor(() => expect(createMediaUploadUrl).toHaveBeenCalledWith("model", "steak.glb"));
    await waitFor(() => expect(uploadToSignedUrl).toHaveBeenCalled());
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByText("steak.glb")).toBeTruthy();
  });
});
