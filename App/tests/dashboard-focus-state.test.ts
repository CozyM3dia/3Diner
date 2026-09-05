import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("dashboard focus state", () => {
  it("neutralizes legacy orange text-field focus rings in the v2 shell", () => {
    const css = readFileSync(resolve(process.cwd(), "src/app/console.css"), "utf8");
    expect(css).toContain(".dv3-root .dp-menuf-input:focus");
    expect(css).toContain(".dv3-root .dp-tax-field input:focus");
    expect(css).toContain("border-color: var(--dv3-line-strong) !important");
    expect(css).toContain("box-shadow: none !important");
  });
});
