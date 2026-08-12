import { AbsoluteFill, Sequence } from "remotion";
import { FilmFinish } from "./components/Backdrop";
import { BrandLockup, ProgressRail } from "./components/Chrome";
import { Soundtrack } from "./Soundtrack";
import { CoretanBuatApa } from "./scenes/CoretanBuatApa";
import { CoretanInstall } from "./scenes/CoretanInstall";
import { CoretanMahal } from "./scenes/CoretanMahal";
import { CoretanMenuCetak } from "./scenes/CoretanMenuCetak";
import { CoretanModel3D } from "./scenes/CoretanModel3D";
import { CoretanRibet } from "./scenes/CoretanRibet";
import { CtaScan } from "./scenes/CtaScan";
import { Harga } from "./scenes/Harga";
import { Intro } from "./scenes/Intro";
import { PraHook } from "./scenes/PraHook";
import { SemuanyaDijawab } from "./scenes/SemuanyaDijawab";
import { TembokAlasan } from "./scenes/TembokAlasan";
import { C } from "./theme";
import { SCENES, SceneKey } from "./timeline";

/**
 * "Coret Alasannya" — six objections a cafe owner actually has, struck through
 * one at a time with proof from the live product.
 *
 * Cuts are hard and land on downbeats of the soundtrack (see ./timeline). The
 * lockup and the progress rail never cut, which is what holds twelve scenes
 * together as one film.
 */
const ORDER: { key: SceneKey; name: string; Component: React.FC }[] = [
  { key: "intro", name: "01 · Intro", Component: Intro },
  { key: "harga", name: "02 · Harga", Component: Harga },
  { key: "praHook", name: "03 · Pra-hook", Component: PraHook },
  { key: "tembokAlasan", name: "04 · Tembok alasan", Component: TembokAlasan },
  { key: "coretanMahal", name: "05 · Mahal", Component: CoretanMahal },
  { key: "coretanInstall", name: "06 · Install aplikasi", Component: CoretanInstall },
  { key: "coretanModel3D", name: "07 · Tidak punya 3D", Component: CoretanModel3D },
  { key: "coretanBuatApa", name: "08 · Buat apa, sih", Component: CoretanBuatApa },
  { key: "coretanRibet", name: "09 · Ribet ngurusnya", Component: CoretanRibet },
  { key: "coretanMenuCetak", name: "10 · Sudah ada menu cetak", Component: CoretanMenuCetak },
  { key: "semuanyaDijawab", name: "11 · Semuanya dijawab", Component: SemuanyaDijawab },
  { key: "ctaScan", name: "12 · CTA scan", Component: CtaScan },
];

export const Promo: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: C.navyDeep }}>
    {ORDER.map(({ key, name, Component }) => (
      <Sequence
        key={key}
        name={name}
        from={SCENES[key].from}
        durationInFrames={SCENES[key].duration}
        layout="none"
      >
        <Component />
      </Sequence>
    ))}

    <BrandLockup />
    <FilmFinish />
    {/* Above the grade: the vignette was pulling the rail off brand orange. */}
    <ProgressRail />
    <Soundtrack />
  </AbsoluteFill>
);
