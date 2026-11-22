"use client";

import { useEffect, useMemo, useRef } from "react";

// Scroll-driven trash cleanup on the homepage: little pieces of trash are
// scattered over the page at the top; as you scroll down each piece fades
// out SLOWLY (over ~10-15% of the page's scroll range) and drifts away.
// By the bottom of the page every piece is gone — messy at the top,
// spotless at the bottom.
//
// Placement is deterministic (seeded PRNG, no Math.random at render) so
// server and client render match and there is no hydration flicker.
// Respects prefers-reduced-motion: the layer is hidden, page is just clean.
// Pointer-events none, tiny and low-opacity so text stays readable.

const PIECE_COUNT = 32;

type PieceType = "paper" | "bottle" | "wrapper" | "can" | "dust" | "lint";

interface Piece {
  id: number;
  type: PieceType;
  x: number; // % of viewport width
  y: number; // % of viewport height
  size: number; // px
  rot: number; // deg
  speed: number; // parallax drift factor vs scrollY
  baseOpacity: number;
  fadeStart: number; // scroll progress where the fade begins (0..1)
  fadeLen: number; // scroll progress the fade takes (0.10-0.15)
  tint: string;
}

// mulberry32 — tiny deterministic PRNG so SSR and client agree.
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TYPES: PieceType[] = ["paper", "bottle", "wrapper", "can", "dust", "lint"];

// Soft, muted fills so the trash reads as litter, not confetti.
const TINTS: Record<PieceType, string[]> = {
  paper: ["#efe9dc", "#e6ddc9", "#f2ede2"],
  bottle: ["#cfe3d8", "#c9dcea", "#d8e6c9"],
  wrapper: ["#eec9c9", "#f0dfae", "#d9c6e8"],
  can: ["#d8d8d8", "#cfd4d8", "#e0d9cc"],
  dust: ["#cbbfa9", "#b9ac96"],
  lint: ["#c4b8a4", "#a8b8a0"],
};

function buildPieces(): Piece[] {
  const rand = mulberry32(20261122);
  const pieces: Piece[] = [];
  for (let i = 0; i < PIECE_COUNT; i++) {
    const type = TYPES[Math.floor(rand() * TYPES.length)];
    const tints = TINTS[type];
    // Spread fade starts across the scroll range with a little jitter,
    // so pieces leave one by one instead of in a clump. The last piece
    // starts fading at ~0.82 and takes up to 0.15, so everything is gone
    // just before the very bottom of the page.
    const fadeStart = Math.min(
      0.84,
      0.02 + (i / PIECE_COUNT) * 0.8 + rand() * 0.04,
    );
    pieces.push({
      id: i,
      type,
      x: 2 + rand() * 94,
      y: 4 + rand() * 88,
      size: type === "dust" ? 6 + rand() * 6 : 12 + rand() * 16,
      rot: rand() * 360 - 180,
      speed: -0.06 + rand() * 0.24,
      baseOpacity: 0.35 + rand() * 0.25,
      fadeStart,
      fadeLen: 0.1 + rand() * 0.05, // 10-15% of scroll range per piece
      tint: tints[Math.floor(rand() * tints.length)],
    });
  }
  return pieces;
}

function PieceShape({ type, tint }: { type: PieceType; tint: string }) {
  const stroke = "#8a7f70";
  switch (type) {
    case "paper":
      return (
        <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill={tint} stroke={stroke} strokeWidth="1" />
          <path
            d="M6 10c3-2 5 2 8 0s4 2 4 0M7 15c2 1 4-1 6 0s3 1 4-1"
            fill="none"
            stroke={stroke}
            strokeWidth="1"
          />
        </svg>
      );
    case "bottle":
      return (
        <svg viewBox="0 0 24 32" width="100%" height="100%" aria-hidden="true">
          <path
            d="M10 1h4v5c2 1 3 3 3 6v16a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V12c0-3 1-5 3-6z"
            fill={tint}
            stroke={stroke}
            strokeWidth="1"
          />
          <rect x="10" y="1" width="4" height="3" fill={stroke} />
        </svg>
      );
    case "wrapper":
      return (
        <svg viewBox="0 0 28 20" width="100%" height="100%" aria-hidden="true">
          <path
            d="M3 10 9 3l7 4 7-3-1 6 3 4-7 3-7-2-6 2z"
            fill={tint}
            stroke={stroke}
            strokeWidth="1"
          />
          <path d="M9 9l4 2 4-2" fill="none" stroke={stroke} strokeWidth="0.8" />
        </svg>
      );
    case "can":
      return (
        <svg viewBox="0 0 20 28" width="100%" height="100%" aria-hidden="true">
          <rect x="3" y="6" width="14" height="20" rx="2" fill={tint} stroke={stroke} strokeWidth="1" />
          <ellipse cx="10" cy="6" rx="7" ry="3" fill={tint} stroke={stroke} strokeWidth="1" />
          <path d="M3 14h14M3 20h14" stroke={stroke} strokeWidth="0.8" />
        </svg>
      );
    case "dust":
      return (
        <svg viewBox="0 0 16 16" width="100%" height="100%" aria-hidden="true">
          <circle cx="4" cy="5" r="2" fill={tint} />
          <circle cx="11" cy="4" r="1.5" fill={tint} />
          <circle cx="8" cy="11" r="2.2" fill={tint} />
        </svg>
      );
    case "lint":
      return (
        <svg viewBox="0 0 24 12" width="100%" height="100%" aria-hidden="true">
          <path
            d="M2 6c3-4 5 4 8 0s5 4 8 0 4-2 4 0"
            fill="none"
            stroke={tint}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}

export default function TrashCleanupParallax() {
  const pieces = useMemo(buildPieces, []);
  const layerRef = useRef<HTMLDivElement | null>(null);
  const nodesRef = useRef<(HTMLSpanElement | null)[]>([]);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    reducedMotionRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reducedMotionRef.current) {
      // Reduced motion: hide the layer entirely — the page is just clean.
      // Done in the effect (not at render) so SSR and client agree.
      if (layerRef.current) layerRef.current.style.display = "none";
      return;
    }

    let raf = 0;
    let ticking = false;

    const update = () => {
      ticking = false;
      const doc = document.documentElement;
      const max = Math.max(1, doc.scrollHeight - window.innerHeight);
      const progress = Math.min(1, Math.max(0, window.scrollY / max));
      const scrollY = window.scrollY;
      for (const p of pieces) {
        const node = nodesRef.current[p.id];
        if (!node) continue;
        // Gradual fade: each piece eases from full to gone across its
        // own 10-15% window of the scroll range — never a sudden pop.
        const faded = Math.min(
          1,
          Math.max(0, (progress - p.fadeStart) / p.fadeLen),
        );
        const opacity = p.baseOpacity * (1 - faded);
        // Drifts at its own parallax rate, floats gently upward and
        // shrinks a little as it fades away.
        const driftY = scrollY * p.speed - faded * 36;
        const scale = 1 - 0.35 * faded;
        const rot = p.rot + scrollY * 0.02 * (p.speed >= 0 ? 1 : -1);
        node.style.opacity = opacity.toFixed(3);
        node.style.transform = `translate3d(0, ${driftY.toFixed(1)}px, 0) rotate(${rot.toFixed(1)}deg) scale(${scale.toFixed(3)})`;
      }
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        raf = requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [pieces]);

  return (
    <div
      ref={layerRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40, // above page content, below the sticky header (z-50)
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {pieces.map((p) => (
        <span
          key={p.id}
          ref={(el) => {
            nodesRef.current[p.id] = el;
          }}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size * (p.type === "bottle" || p.type === "can" ? 1.33 : 1),
            opacity: p.baseOpacity,
            transform: `rotate(${p.rot}deg)`,
            willChange: "transform, opacity",
          }}
        >
          <PieceShape type={p.type} tint={p.tint} />
        </span>
      ))}
    </div>
  );
}
