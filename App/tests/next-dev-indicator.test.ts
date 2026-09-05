import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("development indicator", () => {
  it("does not add a floating badge over dashboard controls", () => {
    const source = readFileSync(resolve(process.cwd(), "next.config.ts"), "utf8");
    expect(source).toMatch(/devIndicators:\s*false/);
  });
});
