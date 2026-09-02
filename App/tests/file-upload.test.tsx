/**
 * @vitest-environment jsdom
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FileUpload from "../src/components/dashboard/FileUpload";
import {
  fileMatchesAccept,
  parseMaxSizeMB,
  validateUploadFile,
} from "../src/components/dashboard/file-upload-validation";

const { createMediaUploadUrl, uploadToSignedUrl } = vi.hoisted(() => ({
  createMediaUploadUrl: vi.fn(),
  uploadToSignedUrl: vi.fn(),
}));

vi.mock("@/lib/dashboard-actions", () => ({
  createMediaUploadUrl,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        uploadToSignedUrl,
      }),
    },
  }),
}));

function pngFile(name = "foto.png", bytes = 64): File {
  return new File([new Uint8Array(bytes)], name, { type: "image/png" });
}

function renderSlot(props: Partial<React.ComponentProps<typeof FileUpload>> = {}) {
  return render(
    <FileUpload
      name="image_url"
      kind="image"
      label="Foto Menu"
      variant="image"
      accept="image/png,image/jpeg,image/webp,image/avif"
      hint="JPG, PNG, atau WebP · maks 30MB"
      {...props}
    />
  );
}

describe("file-upload-validation", () => {
  it("reads max size from the hint and defaults to 30MB", () => {
    expect(parseMaxSizeMB("JPG, PNG, atau WebP · maks 30MB")).toBe(30);
    expect(parseMaxSizeMB("File .glb · maks 15MB")).toBe(15);
    expect(parseMaxSizeMB(undefined)).toBe(30);
    expect(parseMaxSizeMB("tanpa angka")).toBe(30);
  });

  it("accepts matching MIME types and image wildcards", () => {
    expect(fileMatchesAccept(pngFile(), "image/png,image/jpeg")).toBe(true);
    expect(fileMatchesAccept(pngFile(), "image/*")).toBe(true);
    expect(fileMatchesAccept(new File([""], "x.gif", { type: "image/gif" }), "image/png,image/jpeg")).toBe(false);
  });

  it("accepts .glb / .usdz by extension even when MIME is empty or generic", () => {
    const glb = new File([new Uint8Array(8)], "model.glb", { type: "" });
    const usdz = new File([new Uint8Array(8)], "model.usdz", { type: "application/octet-stream" });
    expect(fileMatchesAccept(glb, ".glb,model/gltf-binary,application/octet-stream")).toBe(true);
    expect(fileMatchesAccept(usdz, ".usdz,model/vnd.usdz+zip")).toBe(true);
    expect(fileMatchesAccept(pngFile(), ".glb,model/gltf-binary")).toBe(false);
  });
});

describe("FileUpload dropzone", () => {
  beforeEach(() => {
    createMediaUploadUrl.mockReset();
    uploadToSignedUrl.mockReset();
    createMediaUploadUrl.mockResolvedValue({
      path: "cafe/image/1-foto.png",
      token: "tok",
      publicUrl: "https://cdn.example/foto.png",
    });
    uploadToSignedUrl.mockResolvedValue({ error: null });
    URL.createObjectURL = vi.fn(() => "blob:file-upload-preview");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it("rejects an oversized file without calling createMediaUploadUrl", async () => {
    const user = userEvent.setup();
    renderSlot({ hint: "JPG, PNG · maks 1MB" });

    const tooBig = new File([new Uint8Array(1024 * 1024 + 4)], "besar.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("Foto Menu"), tooBig);

    expect(createMediaUploadUrl).not.toHaveBeenCalled();
    expect(validateUploadFile(tooBig, "image/png", 1)).toMatch(/terlalu besar/i);
    expect(screen.getByRole("alert").textContent).toMatch(/maksimal 1mb/i);
  });

  it("rejects the wrong type with an Indonesian error and skips upload", async () => {
    renderSlot();

    const gif = new File([new Uint8Array(32)], "x.gif", { type: "image/gif" });
    const dropzone = screen.getByText("Pilih file").closest("label");
    expect(dropzone).toBeTruthy();
    fireEvent.drop(dropzone as HTMLElement, {
      dataTransfer: { files: [gif], items: [{ kind: "file" }], types: ["Files"] },
    });

    expect(createMediaUploadUrl).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/jenis file tidak diterima/i);
  });

  it("accepts a matching MIME type and uploads via signed URL", async () => {
    const user = userEvent.setup();
    renderSlot();

    await user.upload(screen.getByLabelText("Foto Menu"), pngFile());

    await waitFor(() => expect(createMediaUploadUrl).toHaveBeenCalledWith("image", "foto.png"));
    await waitFor(() => expect(uploadToSignedUrl).toHaveBeenCalled());
    expect(uploadToSignedUrl.mock.calls[0][0]).toBe("cafe/image/1-foto.png");
    expect(uploadToSignedUrl.mock.calls[0][1]).toBe("tok");
    await waitFor(() => {
      expect((document.querySelector('input[name="image_url"]') as HTMLInputElement).value).toBe(
        "https://cdn.example/foto.png"
      );
    });
  });

  it("shows an object-URL image preview while the signed upload is in flight", async () => {
    let release!: (value: {
      path: string;
      token: string;
      publicUrl: string;
    }) => void;
    createMediaUploadUrl.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );

    const user = userEvent.setup();
    renderSlot();
    await user.upload(screen.getByLabelText("Foto Menu"), pngFile());

    await waitFor(() => {
      const img = document.querySelector("img");
      expect(img?.getAttribute("src")).toBe("blob:file-upload-preview");
    });
    expect(screen.getByText("Mengunggah…")).toBeTruthy();
    expect(createMediaUploadUrl).toHaveBeenCalledTimes(1);

    release({
      path: "cafe/image/1-foto.png",
      token: "tok",
      publicUrl: "https://cdn.example/foto.png",
    });

    await waitFor(() => {
      expect(document.querySelector("img")?.getAttribute("src")).toBe("https://cdn.example/foto.png");
    });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:file-upload-preview");
  });

  it("lets injectedUrl win over the current value without going empty", () => {
    const { rerender } = render(
      <FileUpload
        name="model_3d_url"
        kind="glb"
        label="Model 3D (.glb)"
        accept=".glb,model/gltf-binary,application/octet-stream"
        hint="File .glb · maks 30MB"
        defaultUrl="https://cdn.example/old.glb"
      />
    );

    const hidden = () => document.querySelector('input[name="model_3d_url"]') as HTMLInputElement;
    expect(hidden().value).toBe("https://cdn.example/old.glb");
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByText("old.glb")).toBeTruthy();

    rerender(
      <FileUpload
        name="model_3d_url"
        kind="glb"
        label="Model 3D (.glb)"
        accept=".glb,model/gltf-binary,application/octet-stream"
        hint="File .glb · maks 30MB"
        defaultUrl="https://cdn.example/old.glb"
        injectedUrl="https://cdn.example/tripo-new.glb"
      />
    );

    expect(hidden().value).toBe("https://cdn.example/tripo-new.glb");
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByText("tripo-new.glb")).toBeTruthy();
    expect(screen.queryByText("Tarik file ke sini")).toBeNull();
  });

  it("exposes the empty dropzone as a labelled control, not an unlabelled div", () => {
    renderSlot();
    const input = screen.getByLabelText("Foto Menu");
    expect(input.tagName).toBe("INPUT");
    expect(input.getAttribute("type")).toBe("file");
    expect(document.querySelector("label[for='" + input.id + "']")).toBeTruthy();
  });
});
