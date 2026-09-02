import { after } from "next/server";

/** Jalankan kerja sampingan setelah respons terkirim (notifikasi, log).
 *
 *  Di request Next yang sah memakai `after()` supaya TTFB tidak menunggu
 *  insert notifikasi. Di luar request scope (unit test) dijalankan langsung. */
export function afterResponse(task: () => Promise<unknown>): void {
  const run = () => {
    void Promise.resolve()
      .then(task)
      .catch((err) => {
        console.error("[afterResponse]", err);
      });
  };

  try {
    after(run);
  } catch {
    run();
  }
}
