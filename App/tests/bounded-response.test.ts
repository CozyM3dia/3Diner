import { describe, expect, it } from "vitest";
import { readBoundedArrayBuffer } from "@/lib/bounded-response";

describe("readBoundedArrayBuffer", () => {
  it("reads a response within the byte cap", async () => {
    const buffer = await readBoundedArrayBuffer(new Response(new Uint8Array([1, 2, 3])), 3);
    expect([...new Uint8Array(buffer)]).toEqual([1, 2, 3]);
  });

  it("stops and rejects a streamed response beyond the byte cap", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.enqueue(new Uint8Array([4]));
        controller.close();
      },
    });

    await expect(readBoundedArrayBuffer(new Response(stream), 3)).rejects.toThrow("response_too_large");
  });
});
