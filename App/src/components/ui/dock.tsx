"use client";

import * as React from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type HTMLMotionProps,
  type MotionValue,
  type SpringOptions,
} from "framer-motion";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type DockAxis = "x" | "y";

type DockContextValue = {
  mouse: MotionValue<number>;
  axis: DockAxis;
  size: number;
  magnification: number;
  distance: number;
  disabled: boolean;
};

const DockContext = React.createContext<DockContextValue | null>(null);

function useDockContext() {
  const ctx = React.useContext(DockContext);
  if (!ctx) {
    throw new Error("DockIcon / DockLabel must be used inside <Dock>");
  }
  return ctx;
}

const DEFAULT_SIZE = 16;
const DEFAULT_MAGNIFICATION = 26;
const DEFAULT_DISTANCE = 88;
const SPRING: SpringOptions = { mass: 0.12, stiffness: 160, damping: 14 };

export type DockProps = React.ComponentProps<"div"> & {
  /** Track pointer along this axis. Sidebar nav uses `"y"`. */
  axis?: DockAxis;
  iconSize?: number;
  magnification?: number;
  /** Falloff radius in px — icons beyond this stay at base size. */
  distance?: number;
  /** Force-off (also auto-off under reduced motion / coarse pointer). */
  disableMagnification?: boolean;
};

/**
 * Pointer-proximity magnification container (Apple Dock physics).
 * Children that need scale consume context via `DockIcon` — no cloneElement.
 */
function Dock({
  axis = "y",
  iconSize = DEFAULT_SIZE,
  magnification = DEFAULT_MAGNIFICATION,
  distance = DEFAULT_DISTANCE,
  disableMagnification = false,
  className,
  children,
  onMouseMove,
  onMouseLeave,
  ...props
}: DockProps) {
  const mouse = useMotionValue(Infinity);
  const reduceMotion = useReducedMotion();
  const [finePointer, setFinePointer] = React.useState(true);

  React.useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setFinePointer(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const disabled = disableMagnification || !!reduceMotion || !finePointer;

  const value = React.useMemo<DockContextValue>(
    () => ({
      mouse,
      axis,
      size: iconSize,
      magnification,
      distance,
      disabled,
    }),
    [mouse, axis, iconSize, magnification, distance, disabled],
  );

  return (
    <DockContext.Provider value={value}>
      <div
        data-slot="dock"
        data-axis={axis}
        data-magnify={disabled ? "off" : "on"}
        className={cn("dv3-dock", className)}
        onMouseMove={(e) => {
          if (!disabled) mouse.set(axis === "y" ? e.pageY : e.pageX);
          onMouseMove?.(e);
        }}
        onMouseLeave={(e) => {
          mouse.set(Infinity);
          onMouseLeave?.(e);
        }}
        {...props}
      >
        {children}
      </div>
    </DockContext.Provider>
  );
}

export type DockIconProps = Omit<HTMLMotionProps<"div">, "children"> & {
  children: React.ReactNode;
};

/**
 * Scales its box toward `magnification` as the pointer approaches along the
 * Dock axis. SVG children should fill 100% (see `.dv3-dock-icon` in console.css).
 */
function DockIcon({ className, style, children, ...props }: DockIconProps) {
  const { mouse, axis, size, magnification, distance, disabled } =
    useDockContext();
  const ref = React.useRef<HTMLDivElement>(null);

  const distanceCalc = useTransform(mouse, (val) => {
    const bounds = ref.current?.getBoundingClientRect();
    if (!bounds) return Infinity;
    return axis === "y"
      ? val - bounds.y - bounds.height / 2
      : val - bounds.x - bounds.width / 2;
  });

  const targetSize = disabled ? size : magnification;
  const sizeTransform = useTransform(
    distanceCalc,
    [-distance, 0, distance],
    [size, targetSize, size],
  );
  const springSize = useSpring(sizeTransform, SPRING);

  const zIndex = useTransform(distanceCalc, (d) => {
    if (!Number.isFinite(d)) return 0;
    return Math.max(0, Math.round(40 - Math.abs(d) / 4));
  });

  return (
    <motion.div
      ref={ref}
      data-slot="dock-icon"
      aria-hidden
      className={cn("dv3-dock-icon", className)}
      style={{
        width: disabled ? size : springSize,
        height: disabled ? size : springSize,
        zIndex: disabled ? undefined : zIndex,
        ...style,
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export type DockLabelProps = {
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
  className?: string;
  /** The real nav control (Link / button / span) — owns focus & hover. */
  trigger: React.ReactElement;
};

function wadahKonsol(): HTMLElement | undefined {
  if (typeof document === "undefined") return undefined;
  return (
    document.getElementById("dv3-portal") ??
    document.querySelector<HTMLElement>(".dv3-root") ??
    undefined
  );
}

/**
 * Collapsed-rail label. Expect a single `TooltipProvider` higher in the tree
 * (e.g. around the sidebar nav) so each item does not mount its own provider.
 *
 * Portal ke `#dv3-portal` di dalam `.dv3-root`. Token `--dv3-*` hidup di
 * root konsol, bukan di `body` — tooltip shadcn default ke body jadi
 * tembus. Host portal `position:fixed` supaya tidak ikut baris flex.
 */
function DockLabel({
  children,
  side = "right",
  sideOffset = 14,
  className,
  trigger,
}: DockLabelProps) {
  // Tooltip tertutup saat SSR/hidrasi, sementara host portal sudah berada
  // lebih dulu di Shell. Membacanya langsung menghindari render ekstra pada
  // setiap label sidebar (sebelumnya satu setState per item setelah mount).
  const wadah = wadahKonsol();

  return (
    <Tooltip>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent
        side={side}
        sideOffset={sideOffset}
        container={wadah}
        className={cn("dv3-dock-tip", className)}
      >
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

export { Dock, DockIcon, DockLabel, TooltipProvider as DockTooltipProvider };
