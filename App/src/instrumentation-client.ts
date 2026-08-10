// Client instrumentation datadog.
//
// Berjalan sekali DI BROWSER, sebelum React hydration (konvensi
// instrumentation-client di Next.js >= 15.3). Nama view otomatis
// dinormalisasi oleh nextjsPlugin() — rute dinamis seperti /[slug]/../login
// jadi /[slug].
//
// Aman tanpa konfigurasi: kalau NEXT_PUBLIC_DATADOG_* belum diset (misal
// local dev), SDK tidak diinisialisasi dan halaman tetap jalan normal.
import { datadogRum } from "@datadog/browser-rum";
import { nextjsPlugin, onRouterTransitionStart } from "@datadog/browser-rum-nextjs";

// Next.js memanggil ini saat navigasi klien dimulai, agar RUM mencatat URL
// yang benar (termasuk query) sebelum window.location berubah.
export { onRouterTransitionStart };

const applicationId = process.env.NEXT_PUBLIC_DATADOG_APPLICATION_ID;
const clientToken = process.env.NEXT_PUBLIC_DATADOG_CLIENT_TOKEN;

if (applicationId && clientToken) {
  try {
    datadogRum.init({
      applicationId,
      clientToken,
      site: process.env.NEXT_PUBLIC_DATADOG_SITE || "datadoghq.com",
      service: process.env.NEXT_PUBLIC_DATADOG_SERVICE ?? "3diner-web",
      env: process.env.NEXT_PUBLIC_DATADOG_ENV ?? process.env.NODE_ENV,
      version: process.env.NEXT_PUBLIC_DATADOG_VERSION,
      sessionSampleRate: 100,
      sessionReplaySampleRate: 20,
      defaultPrivacyLevel: "mask-user-input",
      trackUserInteractions: true,
      trackResources: true,
      trackLongTasks: true,
      // Inject header trace ke API sendiri agar bisa dikorelasikan dengan
      // fungsi Vercel (via Datadog Vercel integration) kalau dipasang.
      allowedTracingUrls: [typeof location !== "undefined" ? location.origin : ""],
      plugins: [nextjsPlugin()],
    });
  } catch (err) {
    // Jangan sampai kegagalan monitoring memecah aplikasi.
    console.error("[datadog] RUM init gagal", err);
  }
}