"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Box } from "lucide-react";
import { menuOrderBarScrollMargin } from "@/lib/menu-order-bar";

const TRANSITION_MARKER = "3diner:viewer-transition";

interface Menu3DTransitionLinkProps {
  href: string;
  menuName: string;
  imageUrl?: string | null;
  heroId: string;
}

function heroIsOnScreen(hero: Element): boolean {
  const bounds = hero.getBoundingClientRect();
  return bounds.bottom > 0 && bounds.top < window.innerHeight;
}

export default function Menu3DTransitionLink({
  href,
  menuName,
  imageUrl,
  heroId,
}: Menu3DTransitionLinkProps) {
  const router = useRouter();
  const portalRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const timelineRef = useRef<any | null>(null);
  const navigatingRef = useRef(false);
  const navigatedRef = useRef(false);
  const mountedRef = useRef(true);

  const navigate = () => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    try {
      sessionStorage.setItem(TRANSITION_MARKER, "true");
    } catch {
      // Storage is best-effort; navigation must not depend on browser availability.
    } finally {
      router.push(href);
    }
  };

  // Bersih-bersih saat komponen lepas. GSAP dimuat on-demand (baru ada kalau
  // pengguna mengetuk), jadi cukup hentikan timeline + buang portal yang ada.
  // Kalau ketukan sudah mulai navigasi, jangan batalkan hanya karena re-render
  // melepaskan tautan dari DOM — itu yang membuat ketukan pertama "hanya
  // menggulir" lalu butuh ketukan kedua.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      timelineRef.current?.kill();
      portalRef.current?.remove();
      portalRef.current = null;
      if (navigatingRef.current) navigate();
    };
    // navigate closes over href/router; both are stable for this island's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [href]);

  const handleClick = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.defaultPrevented
    ) {
      return;
    }

    event.preventDefault();

    if (navigatingRef.current) return;
    navigatingRef.current = true;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      navigate();
      return;
    }

    const hero = document.getElementById(heroId);
    // CTA di bawah lipatan: hero sudah di luar layar, morph tidak kelihatan,
    // dan menunggu GSAP hanya membuka jendela race (re-render melepaskan tautan).
    if (!hero || !heroIsOnScreen(hero)) {
      navigate();
      return;
    }

    const bounds = hero.getBoundingClientRect();
    const portal = document.createElement("div");
    const shade = document.createElement("div");
    const label = document.createElement("div");

    portal.setAttribute("data-menu-3d-portal", "true");
    portal.setAttribute("aria-hidden", "true");
    portal.className = imageUrl ? "" : "dish-mesh";
    Object.assign(portal.style, {
      ...(imageUrl ? { backgroundImage: `url("${imageUrl}")` } : {}),
      backgroundPosition: "center",
      backgroundSize: "cover",
      borderRadius: "24px",
      height: "100dvh",
      inset: "0",
      overflow: "hidden",
      pointerEvents: "none",
      position: "fixed",
      transformOrigin: "top left",
      width: "100vw",
      zIndex: "1000",
    });

    Object.assign(shade.style, {
      background: "var(--navy, #0b1f33)",
      inset: "0",
      opacity: "0",
      position: "absolute",
    });

    label.textContent = menuName;
    label.className = "font-display text-3xl font-extrabold text-white";
    Object.assign(label.style, {
      left: "24px",
      maxWidth: "calc(100vw - 48px)",
      opacity: "0",
      position: "absolute",
      top: "50%",
      transform: "translateY(-50%)",
      zIndex: "1",
    });

    portal.append(shade, label);
    document.body.appendChild(portal);
    portalRef.current = portal;

    // GSAP dimuat hanya saat animasi benar-benar diminta, bukan saat halaman
    // detail menu dibuka — menghemat ~70KB dari bundle pelanggan.
    try {
      const [{ default: gsap }] = await Promise.all([import("gsap")]);
      if (!mountedRef.current || !portalRef.current) {
        navigate();
        return;
      }

      timelineRef.current = gsap
        .timeline()
        .fromTo(
          portal,
          {
            scaleX: bounds.width / window.innerWidth,
            scaleY: bounds.height / window.innerHeight,
            x: bounds.left,
            y: bounds.top,
          },
          {
            duration: 0.68,
            ease: "power3.inOut",
            scaleX: 1,
            scaleY: 1,
            x: 0,
            y: 0,
          },
        )
        .set(portal, { borderRadius: 0 }, 0.68)
        .to(shade, { duration: 0.36, ease: "power2.in", opacity: 0.94 }, "-=0.3")
        .fromTo(
          label,
          { opacity: 0, y: 18 },
          { duration: 0.3, ease: "power2.out", opacity: 1, y: 0 },
          "-=0.18",
        )
        .call(navigate, undefined, "-=0.12");
    } catch {
      navigate();
    }
  };

  return (
    <Link
      href={href}
      scroll={false}
      onClick={handleClick}
      className="btn-navy press w-full h-[52px] rounded-2xl inline-flex items-center justify-center gap-2.5 font-semibold text-[15px]"
      style={{ scrollMarginBottom: menuOrderBarScrollMargin(12) }}
    >
      <Box size={18} strokeWidth={2} />
      Lihat Model 3D
    </Link>
  );
}
