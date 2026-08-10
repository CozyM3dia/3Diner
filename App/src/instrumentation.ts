import type { Instrumentation } from "next";

// ── Datadog — error reporting sisi server ────────────────────────────────
//
// Vercel serverless tidak bisa menjalankan dd-trace/Agent seperti di host
// biasa: jejak, log fungsi, dan metrics fungsi harus ditangkap lewat
// "Datadog Vercel integration" (Vercel Marketplace). Yang aplikasi lakukan di
// sini adalah jaring pengaman: setiap error yang ditangkap Next.js (render,
// route handler, server action) dikirim langsung ke Datadog Logs intake lewat
// HTTP tanpa agent — cukup sebuah DD_API_KEY.
//
// Aman tanpa konfigurasi: kalau DD_API_KEY tidak ada, hook tidak melakukan
// apa pun dan aplikasi berjalan seperti biasa.

const DD_API_KEY = process.env.DD_API_KEY;
const DD_SITE = process.env.DD_SITE ?? "datadoghq.com";
const SERVICE = process.env.DD_SERVICE ?? "3diner";
const ENV = process.env.DD_ENV ?? process.env.NODE_ENV ?? "production";
const VERSION = process.env.NEXT_PUBLIC_DATADOG_VERSION;

function toErrorDetail(err: unknown): {
  message: string;
  digest?: string;
  stack?: string;
} {
  if (err instanceof Error) {
    return { message: err.message, stack: err.stack };
  }
  if (typeof err === "object" && err !== null) {
    const maybe = err as { message?: unknown; digest?: unknown; stack?: unknown };
    if (typeof maybe.message === "string" || typeof maybe.digest === "string") {
      return {
        message:
          typeof maybe.message === "string"
            ? maybe.message
            : `Server error (digest ${maybe.digest})`,
        digest: typeof maybe.digest === "string" ? maybe.digest : undefined,
        stack: typeof maybe.stack === "string" ? maybe.stack : undefined,
      };
    }
    return { message: JSON.stringify(err).slice(0, 500) };
  }
  return { message: String(err) };
}

export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context
) => {
  if (!DD_API_KEY) return;

  const detail = toErrorDetail(err);

  const payload = [
    {
      ddsource: "nextjs",
      ddtags: [
        `env:${ENV}`,
        `service:${SERVICE}`,
        VERSION ? `version:${VERSION}` : null,
        `router:${context.routerKind}`,
        `type:${context.routeType}`,
      ]
        .filter((tag): tag is string => Boolean(tag))
        .join(","),
      message: detail.message,
      error: {
        message: detail.message,
        digest: detail.digest,
        stack: detail.stack,
        method: request.method,
        path: request.path,
        routePath: context.routePath,
        routeType: context.routeType,
        renderSource: context.renderSource,
        revalidateReason: context.revalidateReason,
      },
    },
  ];

  try {
    await fetch(`https://api.${DD_SITE}/api/v2/logs`, {
      method: "POST",
      headers: {
        "DD-API-KEY": DD_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Monitoring tidak boleh pecah deadline request yang asli.
  }
};