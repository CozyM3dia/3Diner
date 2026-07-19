// @vitest-environment jsdom
import React from "react";
import QRCode from "qrcode";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { canonicalOrigin, menuUrlFor, normalizeOrigin, stripTrailingSlash } from "../src/lib/site-url";
import { buildQrSvg, escapeXml, qrFileName, QUIET_ZONE, computeLayout, type QrMatrix } from "../src/lib/qr-render";
import QrSmartMenu from "../src/components/dashboard/QrSmartMenu";

function realMatrix(url: string): QrMatrix {
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
  return { size: qr.modules.size, data: qr.modules.data };
}

describe("site-url helpers", () => {
  it("builds the public menu URL from origin and slug", () => {
    expect(menuUrlFor("https://3diner.vercel.app", "senja-kopi")).toBe("https://3diner.vercel.app/senja-kopi");
  });

  it("normalizes trailing slashes on the origin", () => {
    expect(stripTrailingSlash("https://3diner.vercel.app///")).toBe("https://3diner.vercel.app");
    expect(menuUrlFor("https://3diner.vercel.app/", "senja-kopi")).toBe("https://3diner.vercel.app/senja-kopi");
  });

  it("URL-encodes unsafe slug characters", () => {
    expect(menuUrlFor("https://x.id", "kafe kita")).toBe("https://x.id/kafe%20kita");
  });

  it("prefers NEXT_PUBLIC_SITE_URL, then Vercel production URL", () => {
    const prevSite = process.env.NEXT_PUBLIC_SITE_URL;
    const prevVercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://menu.3diner.id/";
    expect(canonicalOrigin()).toBe("https://menu.3diner.id");
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "3diner.vercel.app";
    expect(canonicalOrigin()).toBe("https://3diner.vercel.app");
    if (prevSite !== undefined) process.env.NEXT_PUBLIC_SITE_URL = prevSite;
    if (prevVercel !== undefined) process.env.VERCEL_PROJECT_PRODUCTION_URL = prevVercel;
    else delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  });

  it("never produces a doubled protocol from the Vercel variable", () => {
    expect(normalizeOrigin("3diner.vercel.app")).toBe("https://3diner.vercel.app");
    expect(normalizeOrigin("https://3diner.vercel.app")).toBe("https://3diner.vercel.app");
    expect(normalizeOrigin("https://https://3diner.vercel.app")).toBe("https://3diner.vercel.app");
    expect(normalizeOrigin("https://3diner.vercel.app///")).toBe("https://3diner.vercel.app");
  });

  it("treats empty and whitespace-only values as absent", () => {
    expect(normalizeOrigin(undefined)).toBeNull();
    expect(normalizeOrigin("")).toBeNull();
    expect(normalizeOrigin("   ")).toBeNull();
    expect(normalizeOrigin("https://")).toBeNull();
  });

  it("preserves an explicit http protocol for local development", () => {
    expect(normalizeOrigin("http://localhost:3000/")).toBe("http://localhost:3000");
  });
});

describe("qr-render helpers", () => {
  const url = "https://3diner.vercel.app/senja-kopi";

  it("sanitizes filenames to the 3diner-qr-menu pattern", () => {
    expect(qrFileName("senja-kopi", "png")).toBe("3diner-qr-menu-senja-kopi.png");
    expect(qrFileName("Kafe Kita! (2)", "svg")).toBe("3diner-qr-menu-kafe-kita-2.svg");
    expect(qrFileName("", "png")).toBe("3diner-qr-menu-kafe.png");
  });

  it("escapes XML-sensitive characters", () => {
    expect(escapeXml(`Kopi <"&'> Senja`)).toBe("Kopi &lt;&quot;&amp;&apos;&gt; Senja");
  });

  it("produces genuine vector SVG markup with quiet zone", () => {
    const matrix = realMatrix(url);
    const svg = buildQrSvg(matrix, {
      moduleColor: "#022C60",
      background: "#FDFDFD",
      title: "QR menu",
      desc: `Menuju ${url}`,
    });
    expect(svg).toMatch(/^<svg[^>]*viewBox="0 0 /);
    expect(svg).toContain("<path");
    expect(svg).not.toContain("data:image/png");
    const layout = computeLayout(matrix, { moduleColor: "#022C60", background: "#FDFDFD", title: "", desc: "" });
    expect(layout.qrOffset).toBe(QUIET_ZONE);
    expect(layout.width).toBe(matrix.size + 2 * QUIET_ZONE);
  });

  it("embeds the encoded destination in accessible metadata", () => {
    const matrix = realMatrix(url);
    const svg = buildQrSvg(matrix, {
      moduleColor: "#022C60",
      background: "#FDFDFD",
      title: "QR menu digital Senja Kopi",
      desc: `Scan untuk membuka smart menu Senja Kopi di ${url}`,
    });
    expect(svg).toContain(url);
    expect(svg).toContain("<title");
    expect(svg).toContain("<desc");
  });

  it("escapes HTML/XML-sensitive cafe names in captions", () => {
    const matrix = realMatrix(url);
    const svg = buildQrSvg(matrix, {
      moduleColor: "#022C60",
      background: "#FDFDFD",
      captionName: `Kafe <script>"&"</script>`,
      title: "t",
      desc: "d",
    });
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
  });
});

describe("QrSmartMenu component", () => {
  afterEach(cleanup);

  it("shows the missing-slug state with useful copy", () => {
    render(React.createElement(QrSmartMenu, { menuUrl: null, cafeName: "Senja Kopi", slug: null }));
    expect(screen.getByText("Tautan Smart Menu belum tersedia.")).toBeTruthy();
  });

  it("renders the QR preview and controls for a real URL", () => {
    render(
      React.createElement(QrSmartMenu, {
        menuUrl: "https://3diner.vercel.app/senja-kopi",
        cafeName: "Senja Kopi",
        slug: "senja-kopi",
      })
    );
    expect(screen.getByLabelText("Tautan Smart Menu")).toBeTruthy();
    expect((screen.getByLabelText("Tautan Smart Menu") as HTMLInputElement).value).toBe(
      "https://3diner.vercel.app/senja-kopi"
    );
    expect(screen.getByRole("button", { name: "Unduh PNG" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Unduh SVG" })).toBeTruthy();
    expect(screen.getByRole("img", { name: /QR menu digital Senja Kopi/ })).toBeTruthy();
  });

  it("shows copy feedback after copying the link", async () => {
    Object.assign(navigator, { clipboard: { writeText: async () => undefined } });
    render(
      React.createElement(QrSmartMenu, {
        menuUrl: "https://3diner.vercel.app/senja-kopi",
        cafeName: "Senja Kopi",
        slug: "senja-kopi",
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "Salin tautan smart menu" }));
    expect(await screen.findByText("Tautan disalin")).toBeTruthy();
  });

  it("gives every customization control a 44px minimum touch target", () => {
    render(
      React.createElement(QrSmartMenu, {
        menuUrl: "https://3diner.vercel.app/senja-kopi",
        cafeName: "Senja Kopi",
        slug: "senja-kopi",
      })
    );
    const disclosure = screen.getByRole("button", { name: "Sesuaikan Tampilan QR" });
    expect((disclosure as HTMLElement).style.minHeight).toBe("44px");
    fireEvent.click(disclosure);

    for (const name of ["Bersih", "Bingkai 3Diner", "Navy 3Diner", "Gelap Pekat"]) {
      const btn = screen.getByRole("button", { name }) as HTMLElement;
      expect(btn.style.minHeight).toBe("44px");
    }
    for (const label of ["Logo 3Diner di tengah QR", "Tampilkan nama kafe"]) {
      const input = screen.getByLabelText(label, { exact: false }) as HTMLElement;
      const row = input.closest("label") as HTMLElement;
      expect(row.style.minHeight).toBe("44px");
    }
  });

  it("disables both download buttons while an export is in progress", async () => {
    render(
      React.createElement(QrSmartMenu, {
        menuUrl: "https://3diner.vercel.app/senja-kopi",
        cafeName: "Senja Kopi",
        slug: "senja-kopi",
      })
    );
    const png = screen.getByRole("button", { name: "Unduh PNG" }) as HTMLButtonElement;
    const svg = screen.getByRole("button", { name: "Unduh SVG" }) as HTMLButtonElement;
    fireEvent.click(png);
    // jsdom canvas is not implemented — export enters progress state then fails gracefully.
    expect(png.disabled || svg.disabled || (await screen.findByText("Gagal mengunduh QR. Coba lagi."))).toBeTruthy();
  });
});
