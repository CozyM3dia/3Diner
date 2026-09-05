"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { CheckIcon, ChevronDownIcon, SparklesIcon, XIcon } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { EASE } from "@/components/dp/motion-dp";

const STORAGE_KEY = "3diner.dashboard-v2.setup-checklist.v1";
const OPEN_KEY = "3diner.dashboard-v2.setup-checklist.open";
const DISMISS_KEY = "3diner.dashboard-v2.setup-checklist.dismissed";
const CHANGE_EVENT = "3diner:setup-checklist-change";

const TASKS = [
  {
    id: "profil-toko",
    label: "Lengkapi profil toko",
    action: "Lengkapi",
    href: "/dashboard-v2/pengaturan#profil-toko",
  },
  {
    id: "menu-pertama",
    label: "Tambahkan menu pertama",
    action: "Tambah",
    href: "/dashboard-v2/menu/new",
  },
  {
    id: "pajak",
    label: "Atur pajak & biaya layanan",
    action: "Atur",
    href: "/dashboard-v2/pengaturan/pajak",
  },
  {
    id: "qr-menu",
    label: "Siapkan QR Menu",
    action: "Siapkan",
    href: "/dashboard-v2/pengaturan#qr-smart-menu",
  },
] as const;

const TASK_IDS = new Set<string>(TASKS.map((task) => task.id));

/* Peramban yang memblokir penyimpanan (mode privat ketat, kebijakan kios)
   melempar pada akses pertama. Checklist tidak boleh menjatuhkan seluruh
   konsol karena itu, jadi setiap sentuhan storage dibungkus dan jatuh ke
   salinan dalam-memori yang hidup selama halaman terbuka. */
const memori = new Map<string, string>();

function baca(key: string): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return memori.get(key) ?? "";
  }
}

function tulis(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    memori.set(key, value);
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Satu langganan untuk ketiga kunci: perubahan di tab lain tiba lewat
 *  `storage`, perubahan di tab ini lewat event sintetis. */
function subscribe(callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_KEY || event.key === OPEN_KEY || event.key === DISMISS_KEY) {
      callback();
    }
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

const bacaProgres = () => baca(STORAGE_KEY);
const bacaBuka = () => baca(OPEN_KEY) === "1";
const bacaTutup = () => baca(DISMISS_KEY) === "1";

/* Gerbang hidrasi: snapshot server berbeda dari snapshot klien, jadi React
   merender kosong di HTML dan mengisinya setelah terpasang. Tanpa ini
   markup server (yang tak punya localStorage) dan markup klien berbeda. */
function subscribeHydration() {
  return () => undefined;
}
function readHydrated() {
  return true;
}

function parseCompleted(snapshot: string): string[] {
  if (!snapshot) return [];
  try {
    const value: unknown = JSON.parse(snapshot);
    if (!Array.isArray(value)) return [];
    return value.filter((id): id is string => typeof id === "string" && TASK_IDS.has(id));
  } catch {
    return [];
  }
}

/** Cincin progres kapsul terkatup. */
function Cincin({ selesai, total }: { selesai: number; total: number }) {
  const r = 11;
  const keliling = 2 * Math.PI * r;
  const isi = total ? (selesai / total) * keliling : 0;
  return (
    <span className="dv3-setup-ring-wrap" aria-hidden>
      <svg className="dv3-setup-ring" viewBox="0 0 28 28">
        <circle className="dv3-setup-ring-bg" cx="14" cy="14" r={r} />
        <circle
          className="dv3-setup-ring-on"
          cx="14"
          cy="14"
          r={r}
          strokeDasharray={`${isi.toFixed(2)} ${(keliling - isi).toFixed(2)}`}
        />
      </svg>
      <span className="dv3-setup-ring-num">{selesai}</span>
    </span>
  );
}

/** Checklist onboarding lokal untuk owner baru.
 *
 * Status sengaja tersimpan per-browser: ini penanda progres pribadi, bukan
 * sumber kebenaran konfigurasi toko. Setiap langkah tetap bisa dibatalkan
 * bila owner ingin meninjau ulang persiapannya.
 *
 * Bawaannya TERKATUP. Ia hidup di akhir alur konten setiap layar konsol,
 * sehingga baik kapsul maupun kartu terbuka menambah tinggi halaman alih-
 * alih menutupi panel/tabel. Pilihan buka/katup diingat antar-halaman. */
export default function SetupChecklist() {
  const diam = useReducedMotion();
  const snapshot = useSyncExternalStore(subscribe, bacaProgres, () => "");
  const buka = useSyncExternalStore(subscribe, bacaBuka, () => false);
  const tutup = useSyncExternalStore(subscribe, bacaTutup, () => false);
  const hydrated = useSyncExternalStore(subscribeHydration, readHydrated, () => false);

  const completed = new Set(parseCompleted(snapshot));
  const count = completed.size;
  const progress = Math.round((count / TASKS.length) * 100);
  const allDone = count === TASKS.length;

  const simpan = (next: Set<string>) => tulis(STORAGE_KEY, JSON.stringify([...next]));

  const toggle = (id: string) => {
    const next = new Set(completed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    simpan(next);
  };

  const complete = (id: string) => {
    const next = new Set(completed);
    next.add(id);
    simpan(next);
  };

  if (!hydrated || tutup) return null;

  const sisa = TASKS.length - count;

  return (
    <div className="dv3-setup" data-layout="flow" data-selesai={allDone}>
      {/* Sengaja tanpa AnimatePresence: animasi keluar menahan kartu di DOM
          sampai selesai, jadi selama itu kapsul terkatup dan kartu yang
          sedang mati saling menumpuk di sudut yang sama. Mengatup harus
          seketika; yang perlu dihaluskan hanya kemunculannya. */}
      {buka && (
        <motion.section
          className="dv3-setup-kartu"
          aria-labelledby="setup-checklist-title"
          initial={diam ? false : { opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.22, ease: EASE }}
          style={{ transformOrigin: "bottom right" }}
        >
          {/* Judul dan keadaan berbagi satu baris: pertanyaan "kartu apa ini"
              dan "sudah sampai mana" dijawab dalam satu sapuan mata. */}
          <div className="dv3-setup-head">
            <h2 id="setup-checklist-title" className="dv3-setup-judul">
              Siapkan digital menu
            </h2>
            <p className="dv3-setup-status" aria-live="polite">
              {allDone ? (
                <>
                  <SparklesIcon aria-hidden />
                  Semua beres
                </>
              ) : (
                `${count} dari ${TASKS.length} selesai`
              )}
            </p>
            <button
              type="button"
              className="dv3-setup-x"
              aria-label="Kecilkan checklist persiapan"
              title="Kecilkan"
              onClick={() => tulis(OPEN_KEY, "0")}
            >
              <ChevronDownIcon aria-hidden />
            </button>
            <button
              type="button"
              className="dv3-setup-x"
              aria-label="Tutup checklist persiapan"
              title="Tutup — tidak muncul lagi di browser ini"
              onClick={() => tulis(DISMISS_KEY, "1")}
            >
              <XIcon aria-hidden />
            </button>
          </div>

          <div
            className="dv3-setup-bar"
            role="progressbar"
            aria-label="Progres persiapan digital menu"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <span style={{ width: `${progress}%` }} />
          </div>

          <ul className="dv3-setup-list" aria-label="Checklist persiapan digital menu">
            {TASKS.map((task) => {
              const done = completed.has(task.id);
              return (
                <li key={task.id} className="dv3-setup-baris">
                  <button
                    type="button"
                    className="dv3-setup-tandai"
                    aria-pressed={done}
                    aria-label={`${task.label}. ${done ? "Tandai belum selesai" : "Tandai selesai"}`}
                    onClick={() => toggle(task.id)}
                  >
                    <span className="dv3-setup-kotak" aria-hidden>
                      <CheckIcon strokeWidth={3} />
                    </span>
                    <span className="dv3-setup-label">{task.label}</span>
                  </button>
                  {!done && (
                    <Link href={task.href} className="dv3-setup-aksi" onClick={() => complete(task.id)}>
                      {task.action}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </motion.section>
      )}

      {!buka && (
        <button
          type="button"
          className="dv3-setup-tab"
          aria-expanded={false}
          /* Nama aksesibel HARUS memuat teks yang terlihat (WCAG 2.5.3):
             pengguna perintah suara menyebut apa yang terbaca di layar, dan
             label yang membuangnya membuat kapsul ini tak bisa dipanggil. */
          aria-label={
            allDone
              ? "Persiapan selesai. Buka checklist persiapan."
              : `Siapkan digital menu — ${count} dari ${TASKS.length} selesai. Buka checklist.`
          }
          onClick={() => tulis(OPEN_KEY, "1")}
        >
          <Cincin selesai={count} total={TASKS.length} />
          <span className="dv3-setup-tab-teks">
            {allDone ? "Persiapan selesai" : "Siapkan digital menu"}
          </span>
          {!allDone && <span className="dv3-setup-tab-sisa">{sisa} lagi</span>}
          <ChevronDownIcon style={{ transform: "rotate(180deg)" }} aria-hidden />
        </button>
      )}
    </div>
  );
}
