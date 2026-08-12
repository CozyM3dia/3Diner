/**
 * The six objections, written once.
 *
 * Each one appears three times — in the opening stack, in its own beat, and in
 * the recap — so keeping the strings in one place is what stops the spelling
 * drifting between appearances. The tilt is fixed per objection rather than
 * randomised, so renders stay deterministic.
 */
export const OBJECTIONS = [
  { key: "coretanMahal", text: "“Mahal.”", tilt: -4 },
  { key: "coretanInstall", text: "“Tamu harus install aplikasi?”", tilt: 3 },
  { key: "coretanModel3D", text: "“Saya tidak punya model 3D.”", tilt: -2 },
  { key: "coretanBuatApa", text: "“Buat apa, sih?”", tilt: 4 },
  { key: "coretanRibet", text: "“Ribet ngurusnya.”", tilt: -3 },
  { key: "coretanMenuCetak", text: "“Sudah ada menu cetak, kok.”", tilt: 2 },
] as const;

export type ObjectionKey = (typeof OBJECTIONS)[number]["key"];

const BY_KEY = Object.fromEntries(OBJECTIONS.map((o) => [o.key, o])) as Record<
  ObjectionKey,
  (typeof OBJECTIONS)[number]
>;

export const objection = (key: ObjectionKey) => BY_KEY[key];
