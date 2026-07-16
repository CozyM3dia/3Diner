"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { Box } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

const TRANSITION_MARKER = "3diner:viewer-transition";

interface Menu3DTransitionLinkProps {
  href: string;
  menuName: string;
  imageUrl?: string | null;
  heroId: string;
}

export default function Menu3DTransitionLink({
  href,
  menuName,
  imageUrl,
  heroId,
}: Menu3DTransitionLinkProps) {
  const router = useRouter();
  const linkRef = useRef<HTMLAnchorElement>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const navigatingRef = useRef(false);

  const { contextSafe } = useGSAP(
    () => () => {
      timelineRef.current?.kill();
      portalRef.current?.remove();
      portalRef.current = null;
    },
    { scope: linkRef },
  );

  const navigate = () => {
    sessionStorage.setItem(TRANSITION_MARKER, "true");
    router.push(href);
  };

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
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
    if (!hero) {
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
      backgroundImage: imageUrl ? `url("${imageUrl}")` : "none",
      backgroundPosition: "center",
      backgroundSize: "cover",
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

    timelineRef.current = gsap
      .timeline()
      .fromTo(
        portal,
        {
          borderRadius: "24px",
          scaleX: bounds.width / window.innerWidth,
          scaleY: bounds.height / window.innerHeight,
          x: bounds.left,
          y: bounds.top,
        },
        {
          borderRadius: "0px",
          duration: 0.68,
          ease: "power3.inOut",
          scaleX: 1,
          scaleY: 1,
          x: 0,
          y: 0,
        },
      )
      .to(shade, { duration: 0.36, ease: "power2.in", opacity: 0.94 }, "-=0.3")
      .fromTo(
        label,
        { opacity: 0, y: 18 },
        { duration: 0.3, ease: "power2.out", opacity: 1, y: 0 },
        "-=0.18",
      )
      .call(navigate, undefined, "-=0.12");
  };

  const handleSafeClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    contextSafe(handleClick)(event);
  };

  return (
    <Link
      ref={linkRef}
      href={href}
      onClick={handleSafeClick}
      className="btn-navy press w-full h-[52px] rounded-2xl inline-flex items-center justify-center gap-2.5 font-semibold text-[15px]"
    >
      <Box size={18} strokeWidth={2} />
      Lihat Model 3D
    </Link>
  );
}
