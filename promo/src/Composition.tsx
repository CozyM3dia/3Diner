import { Composition } from "remotion";
import { Promo } from "./Promo";
import { TOTAL_FRAMES } from "./timeline";
import { FPS, HEIGHT, WIDTH } from "./theme";

export const MyComposition = () => {
  return (
    <>
      <Composition
        id="Promo3Diner"
        component={Promo}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
