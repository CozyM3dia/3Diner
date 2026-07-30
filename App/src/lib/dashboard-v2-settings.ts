import { supabaseAdmin } from "@/lib/supabase-admin";

/** Satu baris di kelompok "Perlu dilengkapi".
 *
 *  Hanya hal yang PUNYA konsekuensi nyata dan bisa dikerjakan sekarang. Daftar
 *  pengaturan yang belum diisi tanpa akibat yang jelas tidak akan pernah
 *  disentuh, dan kehadirannya membuat kelompok ini ikut diabaikan. */
export interface SetupTask {
  id: string;
  label: string;
  /** Akibatnya kalau dibiarkan. Ini yang membuat orang mengerjakannya. */
  consequence: string;
  href: string;
  actionLabel: string;
  /** Makin kecil makin mendesak. */
  urgency: number;
}

export interface SettingsSection {
  title: string;
  rows: SettingsRow[];
}

export interface SettingsRow {
  label: string;
  detail: string;
  /** Keadaan sekarang, sebagai kata. */
  state: string;
  href: string;
  /** Sudah dipindahkan ke konsol baru, atau masih di konsol lama. */
  moved: boolean;
}

export interface SettingsPage {
  cafeName: string;
  tasks: SetupTask[];
  sections: SettingsSection[];
  error: string | null;
}

interface CafeRow {
  nama_cafe: string;
  alamat_cafe: string | null;
  slug_url: string;
  qr_token_customer: string | null;
  logo_url: string | null;
  subscription_type: string;
  status_lunas: boolean;
  ai_credits_quota: number;
  ai_credits_used: number;
  tax_configured_at: string | null;
  tax_rate_pct: number;
  service_charge_pct: number;
  tax_pending_from: string | null;
  tax_pending_rate_pct: number | null;
}

/** Menyusun daftar yang perlu dilengkapi dari keadaan kafe.
 *
 *  Dipisah dari query supaya aturannya bisa diuji tanpa database. */
export function buildSetupTasks(cafe: CafeRow, menuCount: number): SetupTask[] {
  const tasks: SetupTask[] = [];

  // Satu-satunya pengaturan yang sengaja tidak punya default diam-diam.
  if (!cafe.tax_configured_at) {
    tasks.push({
      id: "pajak",
      label: "Pajak & service charge",
      consequence: "Struk mencetak 0% tanpa ada yang memilihnya.",
      href: "/dashboard-v2/pengaturan/pajak",
      actionLabel: "Atur sekarang",
      urgency: 0,
    });
  }

  if (menuCount === 0) {
    tasks.push({
      id: "menu",
      label: "Menu masih kosong",
      consequence: "Tamu tidak bisa memesan apa pun.",
      href: "/dashboard-v2/menu",
      actionLabel: "Isi menu",
      urgency: 1,
    });
  }

  if (!cafe.alamat_cafe?.trim()) {
    tasks.push({
      id: "alamat",
      label: "Alamat kafe",
      consequence: "Struk tercetak tanpa alamat.",
      href: "/dashboard/settings",
      actionLabel: "Isi alamat",
      urgency: 2,
    });
  }

  if (!cafe.logo_url?.trim()) {
    tasks.push({
      id: "logo",
      label: "Logo kafe",
      consequence: "Menu tamu memakai nama polos tanpa logo.",
      href: "/dashboard/settings",
      actionLabel: "Unggah logo",
      urgency: 3,
    });
  }

  return tasks.sort((a, b) => a.urgency - b.urgency);
}

/** Kalimat keadaan pajak yang menyebut kapan berlakunya.
 *
 *  Tarif tertunda harus terlihat sebelum tanggalnya tiba, kalau tidak pemilik
 *  akan terkejut oleh angka struk yang berubah sendiri besok pagi. */
export function describeTaxState(cafe: {
  tax_configured_at: string | null;
  tax_rate_pct: number;
  service_charge_pct: number;
  tax_pending_from: string | null;
  tax_pending_rate_pct: number | null;
}): string {
  if (!cafe.tax_configured_at) return "Belum pernah diatur";
  const now = `${cafe.tax_rate_pct}% pajak`;
  const svc = cafe.service_charge_pct > 0 ? ` + ${cafe.service_charge_pct}% layanan` : "";
  if (cafe.tax_pending_from && cafe.tax_pending_rate_pct !== null) {
    const date = new Date(cafe.tax_pending_from).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
    });
    return `${now}${svc} · jadi ${cafe.tax_pending_rate_pct}% mulai ${date}`;
  }
  return `${now}${svc}`;
}

export async function getSettingsPage(cafeId: string | null): Promise<SettingsPage> {
  const empty: SettingsPage = { cafeName: "", tasks: [], sections: [], error: null };
  if (!cafeId) return { ...empty, error: "Kafe belum terhubung ke akun ini." };

  const [cafeResult, menuCount, staffResult] = await Promise.all([
    supabaseAdmin.from("Cafes").select("*").eq("id_cafe", cafeId).maybeSingle(),
    supabaseAdmin
      .from("Menus")
      .select("id_menu", { count: "exact", head: true })
      .eq("cafe_id", cafeId),
    supabaseAdmin.from("Staff").select("role,is_active").eq("cafe_id", cafeId),
  ]);

  if (cafeResult.error || !cafeResult.data) {
    return { ...empty, error: cafeResult.error?.message ?? "Kafe tidak ditemukan." };
  }

  const cafe = cafeResult.data as CafeRow;
  const staff = staffResult.data ?? [];
  const activeStaff = staff.filter((s) => s.is_active).length;
  const cashiers = staff.filter((s) => s.is_active && s.role === "cashier").length;
  const creditsLeft = Math.max(0, cafe.ai_credits_quota - cafe.ai_credits_used);
  /* Kuota dinyatakan TIGA cara sekaligus, mengikuti `needmcp/usage-dashboard`.
     Bukan pengulangan: "78% terpakai" menjawab "seberapa cepat saya
     menghabiskannya", sedangkan "22 tersisa" menjawab "cukup sampai akhir
     bulan?". Keduanya pertanyaan berbeda, dan memilih salah satu berarti
     membuang separuh jawabannya.

     Pembagi nol dijaga: kafe tanpa kuota sama sekali bukan kafe yang sudah
     memakai 0% — ia kafe yang fiturnya belum ada, dan dua keadaan itu tidak
     boleh terbaca sama. */
  const creditsPct =
    cafe.ai_credits_quota > 0
      ? Math.round((cafe.ai_credits_used / cafe.ai_credits_quota) * 100)
      : null;

  const sections: SettingsSection[] = [
    {
      title: "Kafe",
      rows: [
        {
          label: "Pajak & service charge",
          detail: "Tarif yang dicetak di struk dan dihitung di tiap pesanan",
          state: describeTaxState(cafe),
          href: "/dashboard-v2/pengaturan/pajak",
          moved: true,
        },
        {
          label: "Profil kafe",
          detail: "Nama, alamat, logo, sampul, sapaan",
          state: cafe.alamat_cafe?.trim() ? "Lengkap" : "Alamat belum diisi",
          href: "/dashboard/settings",
          moved: false,
        },
        {
          label: "QR meja",
          detail: "Desain dan cetak QR yang ditempel di meja",
          state: cafe.qr_token_customer ? "Aktif" : "Belum dibuat",
          href: "/dashboard/settings#qr-menu",
          moved: false,
        },
      ],
    },
    {
      title: "Orang & akses",
      rows: [
        {
          label: "Staf",
          detail: "Siapa yang boleh membuka konsol kasir",
          state:
            cashiers > 0
              ? `${activeStaff} akun · ${cashiers} kasir`
              : `${activeStaff} akun · belum ada kasir`,
          href: "/dashboard/settings",
          moved: false,
        },
      ],
    },
    {
      title: "Layanan",
      rows: [
        {
          label: "Kredit AI",
          detail: "Pembuatan model 3D dan ekstraksi menu dari foto",
          state:
            creditsPct === null
              ? "belum ada kuota bulan ini"
              : `${creditsPct}% terpakai · ${cafe.ai_credits_used} dari ${cafe.ai_credits_quota} · ${creditsLeft} tersisa`,
          href: "/dashboard/settings",
          moved: false,
        },
        {
          label: "Langganan",
          detail: "Paket dan status pembayaran",
          state: `${cafe.subscription_type} · ${cafe.status_lunas ? "aktif" : "belum lunas"}`,
          href: "/dashboard/settings",
          moved: false,
        },
      ],
    },
  ];

  return {
    cafeName: cafe.nama_cafe,
    tasks: buildSetupTasks(cafe, menuCount.count ?? 0),
    sections,
    error: null,
  };
}
