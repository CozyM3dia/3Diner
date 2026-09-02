/** Isi panduan konsol owner. Data, bukan tampilan.
 *
 *  Dipisah dari `PanduanView` karena indeks lengket, penghitung bab, dan tur
 *  pemandu membaca daftar yang sama. Kalau isinya dijahit di JSX, ketiganya
 *  akan menyimpang satu per satu. Alasan kedua: setiap kalimat di sini adalah
 *  klaim tentang perilaku produk, dan klaim lebih mudah diaudit saat berjejer
 *  daripada saat terselip di antara markup.
 *
 *  ATURAN ISI: hanya tulis yang benar-benar ada di kode hari ini. Layar yang
 *  belum jadi ditandai `segera` dan alasannya ditulis. Batas ditulis eksplisit,
 *  karena owner yang menemukan sendiri sebuah tombol tidak ada akan mengira
 *  produknya rusak.
 */

export type StatusBab = "siap" | "sebagian" | "segera";

export type Bab = {
  id: string;
  no: string;
  grup: string;
  judul: string;
  /** Pertanyaan yang dijawab layar ini. Satu kalimat, sudut pandang owner. */
  jawab: string;
  rute?: string;
  status: StatusBab;
  langkah: { t: string; d: string }[];
  baca?: string[];
  batas?: string[];
};

export const LABEL_STATUS: Record<StatusBab, string> = {
  siap: "Siap dipakai",
  sebagian: "Sebagian nyata",
  segera: "Belum ada",
};

export const BAB: Bab[] = [
  /* ── Mulai ─────────────────────────────────────────────────────────── */
  {
    id: "orientasi",
    no: "01",
    grup: "Mulai",
    judul: "Orientasi konsol",
    jawab: "Saya baru buka konsol. Apa yang saya lihat, dan siapa yang boleh melihatnya?",
    rute: "/dashboard-v2",
    status: "siap",
    langkah: [
      {
        t: "Masuk sebagai staf kafe",
        d: "Konsol hanya terbuka untuk peran Owner. Sesi kasir dialihkan ke /kasir. Akun yang bukan staf kafe mana pun dikembalikan ke halaman masuk, dan alasannya ditulis di layar.",
      },
      {
        t: "Kenali empat grup di sisi kiri",
        d: "Analitik, Operasional (POS, Pesanan, Dapur), Menu (Kategori, Item, Tambahan), dan Pengaturan (tujuh layar). Semuanya tampil sekaligus tanpa menu bertingkat. Lembar Penjualan dibuka lewat tab di kepala lembar analitik, bukan lewat sidebar, supaya rentang tanggalnya ikut berpindah.",
      },
      {
        t: "Pakai bilah atas untuk yang lintas halaman",
        d: "Remah roti menunjukkan posisi, ikon cari membuka pencarian pesanan dan menu (Ctrl+K), lonceng menampung notifikasi, lalu sakelar tema dan menu profil.",
      },
      {
        t: "Kuncupkan sidebar saat butuh lebar",
        d: "Tombol di samping wordmark 3Diner menyempitkan navigasi jadi ikon saja. Pilihannya diingat per perangkat.",
      },
    ],
    baca: [
      "Kanvas terang adalah tampilan utama. Mode gelap punya paletnya sendiri, dan keduanya lolos ambang kontras yang sama.",
      "Angka memakai figur tabular, jadi digit di kolom uang selalu sejajar antar baris. Panjang angka yang berbeda berarti besarannya memang berbeda.",
      "<b>Setiap kontrol yang terlihat punya perilaku nyata.</b> Kalau sebuah fungsi belum ada, kontrolnya dibuang dari layar, jadi tidak ada tombol mati yang perlu dicoba dulu.",
    ],
  },

  /* ── Analitik ──────────────────────────────────────────────────────── */
  {
    id: "ringkasan",
    no: "02",
    grup: "Analitik",
    judul: "Ringkasan",
    jawab: "Bagaimana kafe berjalan hari ini, dan apa yang perlu saya sentuh sekarang?",
    rute: "/dashboard-v2",
    status: "siap",
    langkah: [
      {
        t: "Baca angka otoritatif dulu",
        d: "Pendapatan lunas untuk periode terpilih, dengan sparkline kumulatif di sampingnya. Sparkline menunjukkan apakah sampai hari ini kafe berada di depan atau di belakang laju periode pembanding.",
      },
      {
        t: "Lanjut ke strip empat metrik",
        d: "Pesanan, nilai rata-rata per pesanan, tamu yang membuka menu, dan konversi. Semuanya membaca rentang tanggal yang sama.",
      },
      {
        t: "Cek panel Butuh perhatian",
        d: "Tagihan belum lunas yang lewat 45 menit dan pesanan yang masih di dapur lewat 30 menit naik ke panel ini. Isinya maksimum enam baris, paling genting di atas, dan satu pesanan hanya muncul sekali.",
      },
      {
        t: "Pakai Jam ramai untuk menyusun sif",
        d: "Matriks hari-minggu × jam menunjukkan kapan kasir dan dapur harus penuh. Kolom jamnya dipangkas ke jam buka efektif, jadi jam malam yang selalu kosong tidak ikut memenuhi layar.",
      },
      {
        t: "Telusuri Corong tamu bila konversi turun",
        d: "QR dipindai → model 3D dilihat → mulai pesan → pesanan masuk → lunas. Rasio lanjut ditulis di antara langkah, jadi terlihat di titik mana tamu berhenti.",
      },
    ],
    baca: [
      "<b>Delta selalu punya pembanding sungguhan:</b> rentang yang sama panjangnya, tepat sebelum yang dipilih. Kalau pembandingnya nol, yang tertulis \"Tanpa pembanding\", bukan \"+100%\".",
      "Rasio tanpa penyebut ditulis sebagai tanda pisah, bukan 0%. Menulis \"0% selesai\" akan terbaca seolah ada pesanan yang gagal, padahal pesanannya memang belum ada.",
      "Matriks jam butuh rentang minimal 7 hari. Di bawah itu tampilannya berubah jadi profil 24 jam, karena satu hari Sabtu belum cukup untuk mewakili Sabtu.",
      "Corong menggabungkan jejak klik tamu dengan tabel pesanan. Kalau jejak kliknya gagal dibaca, angka uang tetap tampil dan corongnya sendiri yang menjelaskan kegagalan itu.",
    ],
    batas: [
      "Saat kueri gagal, layar tidak menampilkan angka apa pun dan menyebutkan kegagalannya. Ini disengaja: angka yang salah lebih sulit disadari daripada layar yang mengaku gagal.",
      "Ambang 45 dan 30 menit ditetapkan di kode, bukan di layar Pengaturan. Mengubahnya perlu deploy.",
    ],
  },
  {
    id: "penjualan",
    no: "03",
    grup: "Analitik",
    judul: "Penjualan",
    jawab: "Dari mana uang datang, kapan, dan lewat apa?",
    rute: "/dashboard-v2/penjualan",
    status: "siap",
    langkah: [
      {
        t: "Mulai dari sub-ledger",
        d: "Angka pendapatan yang sama dengan Ringkasan, dibedah jadi lima baris: pesanan lunas, nilai rata-rata, item terjual, belum lunas, dibatalkan.",
      },
      {
        t: "Baca Pendapatan harian",
        d: "Batang per hari, masing-masing dengan penanda periode pembanding. Bentuknya batang dan bukan garis supaya hari tanpa penjualan terbaca sebagai kosong, bukan sebagai penurunan bertahap.",
      },
      {
        t: "Bandingkan laju di grafik kumulatif",
        d: "Garis kumulatif periode ini berhenti di hari terakhir yang sudah lewat. Hari yang belum tiba diarsir, jadi bagian yang memang belum terisi tetap terlihat.",
      },
      {
        t: "Periksa metode bayar, terlaris, kategori, dan status",
        d: "Semuanya batang horizontal berperingkat dengan label langsung. Peringkat menu memakai kontribusi pendapatan, bukan jumlah porsi terjual.",
      },
      {
        t: "Turun ke tabel transaksi, lalu Unduh CSV",
        d: "Tabel untuk memeriksa per pesanan. Unduh CSV merakit berkas dari rentang yang sedang dipilih, berisi deret harian beserta angka pembandingnya lalu daftar transaksi lunas, siap dibuka di spreadsheet atau diserahkan ke pembukuan.",
      },
    ],
    baca: [
      "Ringkasan dan Penjualan berbagi satu rentang tanggal. Menukar tab membawa rentangnya ikut, jadi keduanya tidak pernah membicarakan periode yang berbeda.",
      "Tidak ada diagram donat di konsol ini. Mata lebih akurat membandingkan panjang daripada sudut, jadi porsi terhadap keseluruhan digambar sebagai batang di atas satu garis dasar.",
      "Setiap grafik membawa tabel tersembunyi berisi angka persisnya untuk pembaca layar.",
    ],
  },
  {
    id: "rentang",
    no: "04",
    grup: "Analitik",
    judul: "Rentang tanggal & pembanding",
    jawab: "Periode mana yang sedang saya lihat, dan dibandingkan dengan apa?",
    rute: "/dashboard-v2?from=…&to=…",
    status: "siap",
    langkah: [
      {
        t: "Pilih rentang di kepala lembar",
        d: "Pemilih rentang duduk di kepala yang sama dengan tab Ringkasan/Penjualan. Pilihannya masuk ke URL sebagai <code>?from</code> dan <code>?to</code>.",
      },
      {
        t: "Salin URL untuk membagikan periode",
        d: "Karena rentangnya ada di URL, rekan yang membuka tautan Anda melihat periode yang persis sama, bukan hari ini menurut jamnya sendiri.",
      },
      {
        t: "Baca catatan pembanding di bawah judul",
        d: "Kalimat itu menyebut periode pembanding yang sedang dipakai, jadi asal setiap persentase bisa ditelusuri.",
      },
    ],
    baca: [
      "Pembanding selalu rentang setara panjang tepat sebelum yang dipilih, bukan \"minggu lalu\" yang tetap. Rentang 3 hari dibandingkan dengan 3 hari sebelumnya.",
      "Tidak ada persentase yang ditulis tangan di konsol ini. Semua delta datang dari dua kueri yang sama bentuknya.",
    ],
  },

  /* ── Operasional ───────────────────────────────────────────────────── */
  {
    id: "pos",
    no: "05",
    grup: "Operasional",
    judul: "POS: kasir di layar",
    jawab: "Bagaimana saya menerima pesanan di tempat dan menutup pembayarannya?",
    rute: "/dashboard-v2/pos",
    status: "siap",
    langkah: [
      {
        t: "Pilih kategori, lalu menu",
        d: "Katalog kiri punya baris kategori (Semua Menu plus kategori kafe) dan kotak cari menu. Tombol plus pada kartu langsung memasukkan item ke keranjang tanpa membuka modal.",
      },
      {
        t: "Atur varian dan catatan lewat Item Details",
        d: "Klik kartunya (bukan plus) untuk membuka detail: pilihan/tambahan, jumlah, dan catatan untuk dapur. Enter menyimpan catatan.",
      },
      {
        t: "Tentukan tipe pesanan",
        d: "Baru / Bungkus / Di Dapur pada panel Pesanan Aktif; nomor meja mengikuti tipe yang dipilih.",
      },
      {
        t: "Periksa Ringkasan Pembayaran",
        d: "Subtotal, pajak dan biaya layanan menurut Pengaturan → Pajak, lalu Total bayar. Ringkasan ini dihitung di server. Kalau perhitungannya gagal, tombol bayar menolak lanjut dan menawarkan muat ulang.",
      },
      {
        t: "Tutup dengan Tunai atau QRIS",
        d: "QRIS memunculkan kode di layar, tunai langsung mencatat lunas. Setelah pesanan tersimpan, struk bisa dicetak mengikuti setelan Pengaturan → Struk.",
      },
    ],
    baca: [
      "Panel Pesanan aktif menampung pesanan berjalan hari ini, jadi satu kasir bisa menahan beberapa meja sekaligus.",
      "Pembatalan wajib menyertakan alasan, dan alasan itu tersimpan bersama pesanannya.",
      "Pengiriman pesanan memakai kunci idempoten, jadi klik ganda saat jaringan lambat tidak menghasilkan dua pesanan.",
    ],
  },
  {
    id: "pesanan",
    no: "06",
    grup: "Operasional",
    judul: "Pesanan",
    jawab: "Pesanan mana yang masih terbuka, dan mana yang perlu ditindak?",
    rute: "/dashboard-v2/pesanan",
    status: "siap",
    langkah: [
      {
        t: "Pilih tampilan kanban atau kartu",
        d: "Kanban menyusun pesanan per status; tampilan kartu lebih padat untuk membaca cepat di layar kecil.",
      },
      {
        t: "Saring dan cari",
        d: "Saringan status (Menunggu, Diproses, Siap, Diantar, Selesai, Belum bayar, Lunas) plus pencarian token atau nomor meja.",
      },
      {
        t: "Proses atau batalkan",
        d: "Tombol Proses memajukan tahap. Batalkan meminta alasan dari daftar tetap (pesanan ganda, salah input meja, stok bahan habis, tamu batal memesan), supaya angka pembatalan bisa dibaca nanti.",
      },
    ],
    baca: [
      "Papan ini memakai jendela 30 hari, bukan hari ini saja. Saringan harian akan membuat papan tampak kosong padahal pesanan lama masih terbuka.",
      "Nama pelanggan tidak tersimpan di data. Baris dikenali lewat nomor meja atau label Take Away.",
    ],
  },
  {
    id: "dapur",
    no: "07",
    grup: "Operasional",
    judul: "Dapur (KDS)",
    jawab: "Apa yang sedang dimasak, dan mana yang sudah kelamaan?",
    rute: "/dashboard-v2/dapur",
    status: "siap",
    langkah: [
      {
        t: "Tayangkan papan di layar dapur",
        d: "Kolom tahap menampilkan pesanan berjalan beserta itemnya, cukup besar untuk dibaca dari jarak kerja.",
      },
      {
        t: "Perhatikan penanda \"Lewat 30 Menit\"",
        d: "Keterlambatan dihitung dari umur pesanan, dan ambang 30 menit itu tertulis pada penandanya.",
      },
    ],
    baca: [
      "Papan ini hanya membaca. Perubahan status dilakukan dari Kasir, supaya satu pesanan tidak dipindahkan dua orang ke dua arah.",
      "Sama seperti Pesanan, jendelanya 30 hari.",
    ],
    batas: [
      "Tidak ada tombol Play timer maupun Mark Done. Keduanya ada di template asal, tetapi jalur tulisnya ada di Kasir, jadi tombolnya dibuang.",
    ],
  },
  {
    id: "reservasi",
    no: "08",
    grup: "Operasional",
    judul: "Reservasi",
    jawab: "Bisakah saya menerima booking meja dari konsol?",
    status: "segera",
    langkah: [
      {
        t: "Belum ada, dan ini alasannya",
        d: "Tabel yang namanya mirip (Order_Reservations) sebenarnya memesan stok bahan: item inventaris, jumlah dipesan, dan waktu kedaluwarsa. Memakainya sebagai booking meja akan menampilkan angka yang artinya lain.",
      },
      {
        t: "Sementara ini catat manual",
        d: "Menu Reservasi tetap terlihat dengan tanda \"Belum ada\", jadi statusnya jelas tanpa perlu ditanyakan.",
      },
    ],
  },

  /* ── Menu ──────────────────────────────────────────────────────────── */
  {
    id: "kategori",
    no: "09",
    grup: "Menu",
    judul: "Kategori",
    jawab: "Bagaimana menu saya terkelompok, dan sejak kapan kelompok itu ada?",
    rute: "/dashboard-v2/kategori",
    status: "siap",
    langkah: [
      {
        t: "Lihat daftar kategori beserta jumlah menunya",
        d: "Kolom \"Menu Pertama\" memakai tanggal menu tertua di kategori itu, jadi terlihat sejak kapan kelompoknya dipakai.",
      },
      {
        t: "Klik baris untuk melihat isinya",
        d: "Aksi baris membawa ke daftar Item yang sudah tersaring pada kategori tersebut.",
      },
      {
        t: "Ubah kategori dari editor menu",
        d: "Kategori adalah teks pada menu, bukan tabel tersendiri. Menamai ulang atau memindahkan dilakukan di editor menu: pilih kategori yang ada atau ketik yang baru.",
      },
    ],
    batas: [
      "Tidak ada tombol Export, Filter, atau Column di halaman ini; ketiganya ada di template asal tanpa implementasi.",
      "Menghapus kategori tidak tersedia. Kategori berhenti ada dengan sendirinya saat menu terakhirnya berpindah.",
    ],
  },
  {
    id: "item",
    no: "10",
    grup: "Menu",
    judul: "Item & editor menu",
    jawab: "Bagaimana saya menambah menu, foto, model 3D, dan jadwal tayangnya?",
    rute: "/dashboard-v2/items",
    status: "siap",
    langkah: [
      {
        t: "Telusuri grid item",
        d: "Setiap kartu menunjukkan status Live atau Offline. Kotak cari menyaring per nama.",
      },
      {
        t: "Isi Detail Menu",
        d: "Nama (maks 120 karakter), harga wajib lebih dari 0, kategori (pilih yang ada atau ketik baru), deskripsi, bahan dipisah koma, dan kalori.",
      },
      {
        t: "Unggah foto",
        d: "JPG, PNG, atau WebP, maksimal 5MB. Pratinjaunya tampil seperti yang akan dilihat tamu.",
      },
      {
        t: "Pasang model 3D",
        d: "Berkas .glb atau .gltf hingga 60MB. Model inilah yang membuat menu bisa dilihat tamu dalam 3D dan AR. Pratinjaunya bisa diperbesar sampai layar penuh untuk memeriksa skala.",
      },
      {
        t: "Atur diskon dan jadwal tayang",
        d: "Diskon 0 sampai 90% menampilkan harga setelah diskon. Hari Tayang plus Jam Mulai/Selesai menentukan kapan item muncul di menu digital, dan sakelar Digital Menu menentukan tayang atau tidaknya sama sekali.",
      },
      {
        t: "Simpan",
        d: "Simpan Menu untuk item baru, Simpan Perubahan untuk yang sudah ada. Kesalahan isian muncul di kolomnya masing-masing.",
      },
    ],
    baca: [
      "Titik Live atau Offline berasal dari status aktif menu, bukan penanda vegetarian seperti di template asal.",
      "Langkah \"lihat 3D\" di Corong tamu hanya terisi untuk menu yang punya model, jadi corongnya akan tampak datar selama katalog belum bermodel.",
    ],
    batas: [
      "Kebab menu hanya berisi Edit. Hapus dan Sembunyikan tidak ditampilkan karena belum punya jalur tulis.",
    ],
  },
  {
    id: "tambahan",
    no: "11",
    grup: "Menu",
    judul: "Tambahan (addon)",
    jawab: "Bagaimana saya menjual level pedas, topping, atau ukuran sebagai pilihan berbayar?",
    rute: "/dashboard-v2/addons",
    status: "siap",
    langkah: [
      {
        t: "Klik Add Addon",
        d: "Pilih menunya dari dropdown. Daftarnya diambil dari seluruh menu kafe, jadi menu yang belum punya addon pun bisa dipilih.",
      },
      {
        t: "Tentukan grup pilihan",
        d: "Grup adalah wadah pilihan, misalnya \"Level\" atau \"Topping\". Grup pertama dibuat otomatis dengan minimum 0 dan maksimum 5 pilihan saat sebuah menu mendapat addon pertamanya.",
      },
      {
        t: "Isi nama dan harga tambahan",
        d: "Harga tambahan adalah selisih rupiah di atas harga menu, boleh 0 untuk pilihan gratis seperti tingkat es.",
      },
      {
        t: "Nyalakan atau matikan lewat badge Status",
        d: "Klik badge untuk menonaktifkan tanpa menghapus. Ini cara menyembunyikan topping yang stoknya habis hari ini.",
      },
    ],
    baca: [
      "Nama pilihan tidak boleh kembar dalam satu grup. Simpan akan ditolak dengan alasannya.",
      "Menyunting addon butuh wewenang kelola menu, dan hanya menyentuh data kafe yang sedang aktif.",
    ],
    batas: [
      "Kupon tidak dibuat, atas permintaan pemilik produk. Grup Menu berisi Kategori, Item, dan Tambahan saja.",
    ],
  },

  /* ── Pengaturan ────────────────────────────────────────────────────── */
  {
    id: "toko",
    no: "12",
    grup: "Pengaturan",
    judul: "Toko",
    jawab: "Bagaimana identitas kafe tampil di menu digital dan struk?",
    rute: "/dashboard-v2/pengaturan",
    status: "siap",
    langkah: [
      {
        t: "Unggah Logo Toko dan Gambar Sampul",
        d: "Logo dipakai ulang di struk bila opsi logonya dinyalakan. Sampul jadi kepala halaman menu pelanggan.",
      },
      {
        t: "Tulis alamat dan sapaan",
        d: "Sapaan di Halaman Pelanggan adalah kalimat pertama yang dibaca tamu setelah memindai QR.",
      },
      {
        t: "Tempel tautan ulasan Google Maps",
        d: "Dipakai untuk mengarahkan tamu yang sudah selesai membayar ke halaman ulasan.",
      },
    ],
    batas: [
      "Negara, provinsi, kota, kode pos, email, telepon, dan mata uang tidak ditampilkan. Tabel kafe tidak punya kolomnya, jadi isian itu tidak akan tersimpan.",
    ],
  },
  {
    id: "pajak",
    no: "13",
    grup: "Pengaturan",
    judul: "Pajak & biaya layanan",
    jawab: "Berapa pajak dan servis yang menempel di setiap tagihan?",
    rute: "/dashboard-v2/pengaturan/pajak",
    status: "siap",
    langkah: [
      {
        t: "Sunting dua baris yang ada",
        d: "Satu baris Pajak, satu baris Service Charge. Keduanya dibuka lewat modal Edit.",
      },
      {
        t: "Pilih Inclusive atau Exclusive",
        d: "Inclusive berarti tarif sudah termasuk di harga menu; Exclusive menambahkannya di atas subtotal saat menghitung tagihan.",
      },
      {
        t: "Isi tarif 0 sampai 100",
        d: "Di luar rentang itu, simpan ditolak dengan pesan di kolomnya. Setelah tersimpan, tarif langsung berlaku di POS dan checkout tamu.",
      },
    ],
    batas: [
      "Tidak ada Add New: kafe menyimpan satu konfigurasi pajak, jadi tabelnya dua baris tetap.",
    ],
  },
  {
    id: "struk",
    no: "14",
    grup: "Pengaturan",
    judul: "Struk",
    jawab: "Apa saja yang tercetak di struk, dan bagaimana bentuk akhirnya?",
    rute: "/dashboard-v2/pengaturan/struk",
    status: "siap",
    langkah: [
      {
        t: "Pilih bagian: Header, Isi, atau Footer",
        d: "Tab membagi setelan mengikuti tiga bagian struk, jadi tidak ada satu daftar centang yang panjang tanpa ujung.",
      },
      {
        t: "Nyalakan baris yang ingin tercetak",
        d: "Informasi outlet (logo, nama usaha, alamat), transaksi (nomor nota, waktu, meja, kasir, metode dan status bayar), produk (daftar item, harga satuan, catatan), lalu ringkasan tagihan.",
      },
      {
        t: "Tulis teks footer sendiri",
        d: "Ucapan terima kasih dan waktu cetak bisa dinyalakan terpisah dari teks kustom.",
      },
      {
        t: "Periksa pratinjau, lalu Simpan Perubahan",
        d: "Pratinjau memakai pesanan contoh dan ikut berubah setiap kali sebuah centang diubah, jadi bentuk akhirnya terlihat sebelum kertas pertama tercetak.",
      },
    ],
    batas: [
      "Pembatasan jumlah cetak per struk belum tersedia dan ditandai demikian di layar.",
    ],
  },
  {
    id: "notifikasi",
    no: "15",
    grup: "Pengaturan",
    judul: "Notifikasi",
    jawab: "Peristiwa apa yang memanggil saya, lewat jalur apa, dan pada jam berapa?",
    rute: "/dashboard-v2/pengaturan/notifikasi",
    status: "sebagian",
    langkah: [
      {
        t: "Pilih jalur yang aktif",
        d: "Dua jalur hidup: lonceng di bilah atas konsol, dan notifikasi desktop berupa pop-up sistem operasi plus bunyi di perangkat yang sedang dipakai.",
      },
      {
        t: "Atur matriks per peristiwa",
        d: "Tiap jenis peristiwa (pesanan, dapur, kotak masuk) bisa dinyalakan sendiri per jalur.",
      },
      {
        t: "Tetapkan jam tenang",
        d: "Jam mulai dan selesai membungkam bunyi di luar jam layan tanpa mematikan catatannya di lonceng.",
      },
    ],
    batas: [
      "Email kafe, SMS, dan notifikasi ke ponsel staf ditandai \"menyusul\". Jalurnya belum tersambung, jadi mencentangnya belum menghasilkan kiriman.",
    ],
  },
  {
    id: "qr",
    no: "16",
    grup: "Pengaturan",
    judul: "QR Smart Menu",
    jawab: "Bagaimana tamu sampai ke menu 3D saya dari atas meja?",
    rute: "/dashboard-v2/pengaturan",
    status: "siap",
    langkah: [
      {
        t: "Salin tautan smart menu",
        d: "Tautan itu adalah pintu masuk tamu. Tempel di bio media sosial atau kirim ke pemesan lewat pesan.",
      },
      {
        t: "Unduh QR sebagai PNG atau SVG",
        d: "PNG untuk cetak cepat. Pilih SVG kalau QR-nya akan ditata ulang di tent card, karena ketajamannya tidak hilang saat diperbesar.",
      },
      {
        t: "Cetak dan taruh di meja",
        d: "Pemindaian dari QR inilah yang mengisi langkah pertama Corong tamu di Ringkasan.",
      },
    ],
  },
  {
    id: "peran",
    no: "17",
    grup: "Pengaturan",
    judul: "Peran & izin",
    jawab: "Siapa boleh membuka apa, dan bagian mana dari matriks ini yang sudah ditegakkan?",
    rute: "/dashboard-v2/pengaturan/peran",
    status: "sebagian",
    langkah: [
      {
        t: "Pilih peran di kartu kiri",
        d: "Matriks kanan menampilkan modul × aksi untuk peran yang dipilih.",
      },
      {
        t: "Ubah wewenang Lihat",
        d: "Kolom Lihat pada modul ber-izin (pesanan, menu, inventaris, pengaturan) tersimpan per kafe dan ditegakkan server pada permintaan berikutnya.",
      },
      {
        t: "Simpan Perubahan",
        d: "Pesan setelah simpan menyebut apa yang tersimpan dan apa yang masih pratinjau.",
      },
    ],
    baca: [
      "Server menahan perubahan yang akan mengunci Anda sendiri di luar konsol.",
      "Menonaktifkan Lihat untuk kasir berlaku pada permintaan berikutnya, bukan setelah kasir logout.",
    ],
    batas: [
      "Aksi granular (Tambah, Ubah, Hapus, Ekspor, Setujui) masih pratinjau. Centangnya tersimpan, penegakannya menyusul, dan layar menyebutkan itu saat disimpan.",
    ],
  },
  {
    id: "staf",
    no: "18",
    grup: "Pengaturan",
    judul: "Staf",
    jawab: "Bagaimana saya menambah kasir baru dan mencabut aksesnya saat ia keluar?",
    rute: "/dashboard-v2/pengaturan/staf",
    status: "siap",
    langkah: [
      {
        t: "Tambah Staf",
        d: "Buat akun dengan nama dan peran. Akun langsung bisa masuk sesuai peran yang diberikan.",
      },
      {
        t: "Nonaktifkan saat berhenti",
        d: "Menonaktifkan mencabut akses tanpa menghapus riwayat pesanan yang pernah ia proses.",
      },
      {
        t: "Aktifkan kembali bila kembali bekerja",
        d: "Baris nonaktif tetap terlihat dengan badge, jadi mengaktifkan ulang tidak perlu membuat akun kedua.",
      },
    ],
    batas: [
      "Nomor telepon tidak ditampilkan karena kolomnya tidak ada. Yang ditampilkan tanggal bergabung.",
    ],
  },

  /* ── Kebiasaan ─────────────────────────────────────────────────────── */
  {
    id: "ritme",
    no: "19",
    grup: "Kebiasaan",
    judul: "Ritme harian",
    jawab: "Kalau saya hanya punya lima menit pagi dan lima menit sebelum tutup, apa yang dibuka?",
    status: "siap",
    langkah: [
      {
        t: "Pagi: Ringkasan saja",
        d: "Baca Butuh perhatian lebih dulu (tagihan menua dan pesanan mandek semalam), lalu Jam ramai untuk memastikan sif hari ini sesuai.",
      },
      {
        t: "Saat layan: POS dan Dapur",
        d: "POS di kasir, Dapur di layar belakang. Pesanan dipakai kalau ada yang perlu dicari atau dibatalkan.",
      },
      {
        t: "Tutup kasir: Penjualan",
        d: "Setel rentang ke hari ini, cocokkan pesanan lunas dan metode bayar dengan laci, lalu Unduh CSV bila pembukuan memintanya.",
      },
      {
        t: "Mingguan: Menu",
        d: "Item yang tak pernah muncul di panel Paling dilirik biasanya perlu foto baru atau model 3D. Kalau keduanya sudah dicoba dan tetap sepi, pensiunkan.",
      },
    ],
    baca: [
      "Ctrl+K membuka pencarian dari halaman mana pun. Ini jalan tercepat ke satu pesanan tertentu.",
      "Tautan lembar analitik membawa rentangnya. Kalau rentang tutup kasir selalu sama, simpan tautannya sebagai bookmark.",
    ],
  },
];

/** Grup dalam urutan tampil, dihitung dari BAB supaya indeks dan lembar
 *  tak pernah berbeda isi. */
export const GRUP: { nama: string; babs: Bab[] }[] = BAB.reduce<{ nama: string; babs: Bab[] }[]>((acc, b) => {
  const last = acc[acc.length - 1];
  if (last && last.nama === b.grup) last.babs.push(b);
  else acc.push({ nama: b.grup, babs: [b] });
  return acc;
}, []);

/** Cacah rute yang benar-benar tercakup panduan, dipakai di strip meta.
 *  Bab tanpa rute (Reservasi, Ritme) tidak dihitung supaya angkanya jujur. */
export const CACAH_RUTE = new Set(BAB.map(b => b.rute).filter(Boolean)).size;
