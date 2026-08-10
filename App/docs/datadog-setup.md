# Datadog monitoring setup

Dokumen ini menjelaskan langkah aktivasi dan bagian mana dari 3Diner yang
dipantau, serta apa yang perlu disiapkan di sisi akun Datadog / Vercel.

## Ringkasan arsitektur observasi

Karena 3Diner berjalan sebagai Next.js di Vercel (serverless), jejak APM
server biasa (`dd-trace` + Agent lama) tidak bisa dipasang seperti di host
permanen. Ada tiga jalur data:

| Jalur | Teknologi | Ditangkap di |
| --- | --- | --- |
| Frontend (RUM) | `@datadog/browser-rum` + `@datadog/browser-rum-nextjs` | `src/instrumentation-client.ts` + `<DatadogAppRouter />` di root layout |
| Error server | Hook `onRequestError` di `src/instrumentation.ts` | Datadog Logs HTTP API |
| Log/jejak/metric fungsi Vercel | Datadog Vercel integration (Vercel Marketplace) | sisi Datadog (dikonfigurasi manual, lihat bawah) |
| Event bisnis | `src/lib/observability.ts` → stdout JSON | masuk sebagai log via Vercel integration |

## Prasyarat di Datadog

1. **RUM application** — buat RUM application tipe *Next.js* / *React*; ambil
   `applicationId` dan `clientToken` (client token publik, aman diread
   publik), lalu set env `NEXT_PUBLIC_DATADOG_APPLICATION_ID` dan
   `NEXT_PUBLIC_DATADOG_CLIENT_TOKEN`.
2. **Datadog API key** — untuk error server, set `DD_API_KEY` di Vercel
   Environment Variables (jangan dibaca ke browser).

## Environment variables

| Variabel | Tujuan | Lokasi aman |
| --- | --- | --- |
| `NEXT_PUBLIC_DATADOG_APPLICATION_ID` | Wajib RUM | Vercel + `.env.local` dev |
| `NEXT_PUBLIC_DATADOG_CLIENT_TOKEN` | Wajib RUM | Vercel + `.env.local` dev |
| `NEXT_PUBLIC_DATADOG_SITE` | Global site, default `datadoghq.com` | opsional |
| `NEXT_PUBLIC_DATADOG_SERVICE` | Nama service RUM, default `3diner-web` | opsional |
| `NEXT_PUBLIC_DATADOG_ENV` | Lingkungan RUM (prod/staging) | opsional |
| `NEXT_PUBLIC_DATADOG_VERSION` | Version commit/model deploy | opsional |
| `DD_API_KEY` | Server error reporting | Vercel secret |
| `DD_SITE` | Site server, default `datadoghq.com` | opsional |
| `DD_SERVICE` | Service server, default `3diner` | opsional |
| `DD_ENV` | Env server, default `NODE_ENV` | opsional |

Pada RUM pakai `NEXT_PUBLIC_` karena client; yang sensitif (`DD_API_KEY`)
tidak boleh punya prefix `NEXT_PUBLIC_`.

## Integrasi Vercel (fungsi log/trace/metric)

Supaya log & jejak fungsi Vercel (termasuk /api/*, server actions, e
middleware) masuk Datadog:

1. Buka Vercel Dashboard → **Integrations / Marketplace** → **Datadog**.
2. Sambungkan workspace Vercel dengan org Datadog, pilih project `3diner`.
3. Setelah aktif, log atau traces dari fungsi streaming ke Datadog membawa
   header trace untuk korelasi dengan RUM.

## Alert & metrics yang disarankan (bisa dibuat setelah data mengalir)

- **Error rate route**: `@` `route` (path) dengan status 5xx > 0, alert.
- **Order flow**: buat log metric dari `emitBusinessEvent` mis.
  `order.created`, `payment.charge_failed`, `payment.webhook_timeout`.
- **RUM Web Vitals**: LCP/CLS/INP — pantau per view `/kasir`, `/dashboard`,
  dan `/[...rest]`.
- **SLO pembayaran**: success rate charge dll dari events di atas.

## Catatan privasi

- `onRequestError` tidak meneruskan `request.headers` (yang berisi cookie),
  hanya `method` + `path` + konteks error.
- RUM memakai `defaultPrivacyLevel: "mask-user-input"`; konten input
  pengguna tidak direkam mentah.
- Klien service key tetap hanya di server; tidak ada key rahasia yang
  masuk file browser.

## Menonaktifkan

Hapus `NEXT_PUBLIC_DATADOG_*` / `DD_API_KEY` (atau jangan set) → semua
pengambilan data berhenti dengan sendirinya; kode aman `if` tak menginisialisasi.