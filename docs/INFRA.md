# 3Diner — Infrastructure Reference

> Nilai non-rahasia. Token/key/password JANGAN ditaruh di sini (pakai `.env.local` / `.mcp.json` yang gitignored).
> Setup 2026-06-19.

---

## Supabase
- Project: **3diner**
- Ref: `zvkmcbvckuupjsdftsyz`
- Region: Singapore (`ap-southeast-1`)
- URL: `https://zvkmcbvckuupjsdftsyz.supabase.co`
- Tabel: `Cafes`, `Menus`, `Analytics_Logs` (+ RLS aktif, bucket `dish-images` publik)
- Anon key → `App/.env.local` (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- PAT + DB password → di luar repo (chat/manual). MCP: `.mcp.json` (read-only).

## Vercel
- Project: **3diner** (team `cozym3dias-projects`, id `team_gwSahsksqUOERKxhgHeEPOzl`)
- Live: `https://3diner.vercel.app`
- Env Supabase terset (production/preview/development)
- Deploy: via CLI (token). Git-integration MASIH ke repo lama `3Dinner_Website` → reconnect ke `CozyM3dia/3Diner` (root dir `App`) untuk auto-deploy.

## GitHub
- Repo: **CozyM3dia/3Diner**
- Root repo = `C:\Kerja\3Diner` (App + docs + Asset + Web Dashboard satu repo)
- Rahasia di-gitignore: `.mcp.json`, `.env*`, `.vercel`

## Cloudflare R2 (storage model 3D)
- Account: `978f41ac95a2cd32029908d1b37b8981` (Cozybytesmedia@gmail.com)
- Bucket: **`3diner-models`** (APAC, Standard)
- Bucket ID: `e808ff58996f4276a00e41068211b7ef`
- **Public base URL:** `https://pub-e808ff58996f4276a00e41068211b7ef.r2.dev`
  - file: `https://pub-e808ff58996f4276a00e41068211b7ef.r2.dev/<key>`
- S3 endpoint (untuk upload): `https://978f41ac95a2cd32029908d1b37b8981.r2.cloudflarestorage.com`
- **BELUM ada S3 creds** (Access Key ID + Secret) untuk upload dari app → buat di dashboard: **R2 → Manage R2 API Tokens → Create** (scope: Object Read & Write, bucket `3diner-models`). Simpan di `App/.env.local`:
  - `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET=3diner-models`, `NEXT_PUBLIC_R2_PUBLIC_URL=https://pub-e808ff58996f4276a00e41068211b7ef.r2.dev`

## MCP (di `.mcp.json`, perlu restart Claude Code)
- `supabase` — read-only, project-ref 3diner.
- `cloudflare-api` — remote (OAuth saat connect). Catatan: R2 sudah disetup via API token, MCP CF opsional.

## Status
| Komponen | Status |
|----------|--------|
| Supabase | ✅ schema + RLS |
| Vercel | ✅ live |
| GitHub | ✅ pushed |
| R2 bucket + public | ✅ |
| R2 S3 upload creds | ⏳ dashboard (manual) |
| Vercel↔repo baru auto-deploy | ⏳ reconnect dashboard |
