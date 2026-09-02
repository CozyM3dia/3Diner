/**
 * @vitest-environment jsdom
 */
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StoreSettingsForm from "../src/components/dp/StoreSettingsForm";
import { MAX_FOTO } from "../src/components/dp/menu-editor-upload";

const { createMediaUploadUrl, uploadToSignedUrl } = vi.hoisted(() => ({
  createMediaUploadUrl: vi.fn(),
  uploadToSignedUrl: vi.fn(),
}));

vi.mock("@/lib/dashboard-actions", () => ({
  createMediaUploadUrl,
  updateCafeSettings: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: {
      from: () => ({ uploadToSignedUrl }),
    },
  }),
}));

const DEMO_LOGO = "https://cdn.example/demo-logo.png";
const DEMO_COVER = "https://cdn.example/demo-cover.jpg";

const cafe = {
  nama_cafe: "Senja Kopi (Demo)",
  alamat_cafe: "Jl. Kartini No. 10, Bandar Lampung",
  greeting: "Selamat datang di Senja Kopi",
  google_maps_review_url: null,
  logo_url: DEMO_LOGO,
  cover_url: DEMO_COVER,
};

function dropOn(label: string, file: File) {
  const zone = screen.getByLabelText(label).closest(".dp-menuf-dropwrap")?.querySelector(".dp-menuf-dropzone");
  fireEvent.drop(zone as HTMLElement, {
    dataTransfer: { files: [file], items: [{ kind: "file" }], types: ["Files"] },
  });
}

describe("StoreSettingsForm image slots", () => {
  beforeEach(() => {
    createMediaUploadUrl.mockReset();
    uploadToSignedUrl.mockReset();
    URL.createObjectURL = vi.fn(() => "blob:settings-preview");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(cleanup);

  it("rejects a .txt on Logo Toko in Indonesian and does not call signed upload", () => {
    render(<StoreSettingsForm cafe={cafe} />);

    dropOn("Unggah Logo Toko", new File([new Uint8Array(8)], "notes.txt", { type: "text/plain" }));

    expect(createMediaUploadUrl).not.toHaveBeenCalled();
    expect(uploadToSignedUrl).not.toHaveBeenCalled();
    expect(screen.getByText("File harus berupa gambar (JPG/PNG/WebP).")).toBeTruthy();
    expect(screen.queryByText(/mime type/i)).toBeNull();
    expect((document.querySelector('input[name="logo_url"]') as HTMLInputElement).value).toBe(DEMO_LOGO);
    expect((document.querySelector('input[name="cover_url"]') as HTMLInputElement).value).toBe(DEMO_COVER);
  });

  it("rejects an oversized logo without clearing the stored demo URLs", () => {
    render(<StoreSettingsForm cafe={cafe} />);

    const big = new File([new Uint8Array(MAX_FOTO + 4)], "besar.png", { type: "image/png" });
    dropOn("Unggah Logo Toko", big);

    expect(createMediaUploadUrl).not.toHaveBeenCalled();
    expect(screen.getByText("Ukuran foto maksimal 5MB.")).toBeTruthy();
    expect((document.querySelector('input[name="logo_url"]') as HTMLInputElement).value).toBe(DEMO_LOGO);
    expect((document.querySelector('input[name="cover_url"]') as HTMLInputElement).value).toBe(DEMO_COVER);
  });
});
