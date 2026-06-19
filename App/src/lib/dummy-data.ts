import type { Cafe, Menu } from "@/types";

// ─── Local .ply Gaussian Splatting models ──────────────────────────────────
// Diserve dari /public/models/ → Next.js static file server
const MODEL_SUSHI    = "/models/sushi.ply";
const MODEL_TOMATOES = "/models/tomatoes.ply";

// ─── Dummy Cafe ────────────────────────────────────────────────────────────
export const DUMMY_CAFE: Cafe = {
  id_cafe: "cafe-senja-001",
  nama_cafe: "Senja Kopi",
  alamat_cafe: "Jl. Braga No. 42, Bandung, Jawa Barat",
  slug_url: "senja-kopi",
  qr_token_customer: "tok_cust_senja001",
  subscription_type: "Tier 100k",
  status_lunas: true,
  created_at: "2024-01-01T00:00:00Z",
};

// ─── Dummy Menus ───────────────────────────────────────────────────────────
export const DUMMY_MENUS: Menu[] = [
  {
    id_menu: "menu-001",
    cafe_id: "cafe-senja-001",
    nama_menu: "Es Kopi Susu",
    harga_menu: 28000,
    description_menu:
      "Espresso premium yang dipadukan dengan susu segar pilihan dan es batu kristal. Nikmat dalam setiap tegukan.",
    model_3d_url: MODEL_SUSHI,
    redirect_link: "https://order.senjacafe.id/menu/es-kopi-susu",
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id_menu: "menu-002",
    cafe_id: "cafe-senja-001",
    nama_menu: "Matcha Latte",
    harga_menu: 32000,
    description_menu:
      "Bubuk matcha ceremonial grade dari Uji, Kyoto, diseduh dengan susu oat creamy dan sedikit madu alami.",
    model_3d_url: MODEL_TOMATOES,
    redirect_link: "https://order.senjacafe.id/menu/matcha-latte",
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id_menu: "menu-003",
    cafe_id: "cafe-senja-001",
    nama_menu: "Caramel Macchiato",
    harga_menu: 35000,
    description_menu:
      "Latte art dengan drizzle karamel salted di atas lapisan foam susu yang lembut. Manis, gurih, sempurna.",
    model_3d_url: MODEL_SUSHI,
    redirect_link: "https://order.senjacafe.id/menu/caramel-macchiato",
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id_menu: "menu-004",
    cafe_id: "cafe-senja-001",
    nama_menu: "Butter Croissant",
    harga_menu: 22000,
    description_menu:
      "Croissant classic berlapis mentega Prancis, dipanggang fresh setiap pagi. Renyah di luar, lembut di dalam.",
    model_3d_url: MODEL_TOMATOES,
    redirect_link: "https://order.senjacafe.id/menu/butter-croissant",
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id_menu: "menu-005",
    cafe_id: "cafe-senja-001",
    nama_menu: "Avocado Toast",
    harga_menu: 45000,
    description_menu:
      "Sourdough artisan dengan alpukat mashed berbumbu, topping telur poached, microgreens, dan red chili flakes.",
    model_3d_url: MODEL_SUSHI,
    redirect_link: "https://order.senjacafe.id/menu/avocado-toast",
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id_menu: "menu-006",
    cafe_id: "cafe-senja-001",
    nama_menu: "Teh Tarik",
    harga_menu: 18000,
    description_menu:
      "Teh hitam Ceylon strength yang ditarik berkali-kali dengan susu kental. Tradisi rasa yang tak lekang waktu.",
    model_3d_url: MODEL_TOMATOES,
    redirect_link: "https://order.senjacafe.id/menu/teh-tarik",
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id_menu: "menu-007",
    cafe_id: "cafe-senja-001",
    nama_menu: "Cappuccino",
    harga_menu: 30000,
    description_menu:
      "Single origin Ethiopia Yirgacheffe, disajikan sebagai cappuccino klasik dengan microfoam susu yang sempurna.",
    model_3d_url: MODEL_SUSHI,
    redirect_link: "https://order.senjacafe.id/menu/cappuccino",
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id_menu: "menu-008",
    cafe_id: "cafe-senja-001",
    nama_menu: "Basque Cheesecake",
    harga_menu: 38000,
    description_menu:
      "Cheesecake gaya Basque dengan tekstur creamy lembut di dalam dan permukaan yang burnt karamel. Served chilled.",
    model_3d_url: MODEL_TOMATOES,
    redirect_link: "https://order.senjacafe.id/menu/basque-cheesecake",
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id_menu: "menu-009",
    cafe_id: "cafe-senja-001",
    nama_menu: "Pixel Robot",
    harga_menu: 45000,
    description_menu:
      "Model 3D robot dalam format GLB untuk mencoba fitur Model Viewer AR universal di iOS dan Android.",
    model_3d_url: "/models/pixel-robot-15cm.glb",
    redirect_link: "https://order.senjacafe.id/menu/pixel-robot",
    created_at: "2024-01-01T00:00:00Z",
  },
];
