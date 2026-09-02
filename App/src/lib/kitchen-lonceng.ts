/** Penanda bunyi pesanan baru.
 *
 *  Dapur berisik dan mata juru masak ada di wajan, bukan di layar. Kartu yang
 *  muncul diam-diam di pojok papan bisa tidak terlihat sampai tiketnya sudah
 *  merah. Dua nada pendek naik — cukup menembus kebisingan, cukup singkat
 *  untuk tidak jadi gangguan saat pesanan datang beruntun.
 *
 *  Dibangkitkan lewat WebAudio, bukan berkas audio: satu berkas mp3 untuk dua
 *  nada adalah permintaan jaringan yang bisa gagal justru di dapur dengan wifi
 *  paling buruk, dan papan ini harus tetap berbunyi saat koneksinya kembang
 *  kempis.
 *
 *  Mati secara bawaan. Kebijakan autoplay peramban juga menuntut interaksi
 *  lebih dulu, jadi bunyi baru hidup setelah staf menyalakannya sendiri —
 *  dan itu memang satu-satunya cara ia tidak mengagetkan pemilik yang
 *  kebetulan membuka papan ini dari konsol. */

let konteks: AudioContext | null = null;

function ambilKonteks(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Konstruktor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Konstruktor) return null;
  konteks ??= new Konstruktor();
  return konteks;
}

export function bunyikanLonceng() {
  const ctx = ambilKonteks();
  if (!ctx) return;
  // Tab yang lama menganggur menangguhkan konteksnya; tanpa ini lonceng diam
  // persis pada shift sepi di mana ia paling dibutuhkan.
  if (ctx.state === "suspended") void ctx.resume();

  const mulai = ctx.currentTime;
  [
    { hz: 784, pada: 0 },
    { hz: 1047, pada: 0.11 },
  ].forEach(({ hz, pada }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = hz;
    // Serangan cepat lalu peluruhan halus. Gelombang kotak tanpa amplop
    // berbunyi seperti alarm kesalahan, dan alarm kesalahan yang berbunyi
    // dua puluh kali per jam akan dimatikan pada jam pertama.
    gain.gain.setValueAtTime(0.0001, mulai + pada);
    gain.gain.exponentialRampToValueAtTime(0.16, mulai + pada + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, mulai + pada + 0.24);
    osc.connect(gain).connect(ctx.destination);
    osc.start(mulai + pada);
    osc.stop(mulai + pada + 0.26);
  });
}
