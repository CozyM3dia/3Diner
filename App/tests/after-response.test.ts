import { expect, it, vi } from "vitest";
const after = vi.hoisted(() => vi.fn());
vi.mock("next/server", () => ({ after }));
import { afterResponse } from "@/lib/after-response";
it("returns background work to Next so serverless waits for completion", async () => {
  let resolve!: () => void;
  const task = vi.fn(() => new Promise<void>(r => { resolve = r; }));
  afterResponse(task);
  const pending = after.mock.calls[0][0]();
  expect(pending).toBeInstanceOf(Promise);
  await Promise.resolve();
  expect(task).toHaveBeenCalledOnce();
  let finished = false;
  void pending.then(() => { finished = true; });
  expect(finished).toBe(false);
  resolve();
  await pending;
  expect(finished).toBe(true);
});
