"use client";

import React, { useEffect, useRef } from "react";

interface AsciiDissolveImageProps {
  src: string;
  alt: string;
  theme: "light" | "dark";
  className?: string;
  variant?: "card" | "fullbleed" | "banner";
}

/**
 * Renders the crisp stock image intact while softly feathering its outer border
 * into the page background and adding delicate halftone/ASCII corner accents
 * (top-left and bottom-right) just like the reference design.
 */
export function AsciiDissolveImage({
  src,
  alt,
  theme,
  className = "",
  variant = "card",
}: AsciiDissolveImageProps) {
  const overlayRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const drawCornerMatrix = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const isDark = theme === "dark";
      const pageBg = isDark ? "0, 0, 0" : "242, 241, 237";
      const dotRgb = isDark ? "237, 237, 238" : "37, 36, 34";

      // 1. Soft perimeter feather so the image border is never sharp or boxy
      const featherTop = ctx.createLinearGradient(
        0,
        0,
        0,
        Math.min(28, h * 0.1),
      );
      featherTop.addColorStop(0, `rgba(${pageBg}, 0.65)`);
      featherTop.addColorStop(1, `rgba(${pageBg}, 0)`);
      ctx.fillStyle = featherTop;
      ctx.fillRect(0, 0, w, Math.min(28, h * 0.1));

      const featherBottom = ctx.createLinearGradient(
        0,
        h,
        0,
        h - Math.min(32, h * 0.12),
      );
      featherBottom.addColorStop(0, `rgba(${pageBg}, 0.72)`);
      featherBottom.addColorStop(1, `rgba(${pageBg}, 0)`);
      ctx.fillStyle = featherBottom;
      ctx.fillRect(0, h - Math.min(32, h * 0.12), w, Math.min(32, h * 0.12));

      const featherLeft = ctx.createLinearGradient(
        0,
        0,
        Math.min(32, w * 0.05),
        0,
      );
      featherLeft.addColorStop(0, `rgba(${pageBg}, 0.65)`);
      featherLeft.addColorStop(1, `rgba(${pageBg}, 0)`);
      ctx.fillStyle = featherLeft;
      ctx.fillRect(0, 0, Math.min(32, w * 0.05), h);

      const featherRight = ctx.createLinearGradient(
        w,
        0,
        w - Math.min(32, w * 0.05),
        0,
      );
      featherRight.addColorStop(0, `rgba(${pageBg}, 0.65)`);
      featherRight.addColorStop(1, `rgba(${pageBg}, 0)`);
      ctx.fillStyle = featherRight;
      ctx.fillRect(w - Math.min(32, w * 0.05), 0, Math.min(32, w * 0.05), h);

      // 2. Subtle halftone dot & glyph dissolve concentrated only in top-left and bottom-right corners
      const cell = 7;
      const cols = Math.floor(w / cell);
      const rows = Math.floor(h / cell);
      const glyphs = ["·", ":", "+", "•"];

      ctx.font = `6px ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      for (let r = 0; r < rows; r++) {
        const py = r * cell + cell / 2;
        const ny = py / h;
        for (let c = 0; c < cols; c++) {
          const px = c * cell + cell / 2;
          const nx = px / w;

          // Top-left corner cluster
          const dTopLeft = Math.hypot(nx * 1.35, ny * 1.65);
          const tlMask = Math.max(0, 1 - dTopLeft / 0.42);

          // Bottom-right corner cluster
          const dBotRight = Math.hypot((1 - nx) * 1.15, (1 - ny) * 1.35);
          const brMask = Math.max(0, 1 - dBotRight / 0.52);

          const mask = Math.max(tlMask, brMask);
          if (mask <= 0.04) continue;

          // Softly blend background at the outermost corner tip
          if (mask > 0.35) {
            ctx.fillStyle = `rgba(${pageBg}, ${((mask - 0.35) * 0.85).toFixed(3)})`;
            ctx.fillRect(c * cell, r * cell, cell + 0.5, cell + 0.5);
          }

          const pulse = 0.65 + 0.35 * Math.cos(c * 1.9 + r * 2.1);
          const alpha = Math.min(0.85, mask * pulse * (isDark ? 0.78 : 0.72));
          if (alpha > 0.06) {
            ctx.fillStyle = `rgba(${dotRgb}, ${alpha.toFixed(3)})`;
            if ((c + r) % 2 === 0) {
              const rad = Math.max(0.6, Math.min(1.35, mask * 1.4));
              ctx.beginPath();
              ctx.arc(px, py, rad, 0, Math.PI * 2);
              ctx.fill();
            } else {
              ctx.fillText(glyphs[(c + r) % glyphs.length], px, py);
            }
          }
        }
      }
    };

    drawCornerMatrix();
    const observer = new ResizeObserver(drawCornerMatrix);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [theme, variant]);

  return (
    <div
      className={` pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <img
        src={src}
        alt={alt}
        width={1536}
        height={1024}
        loading={src.includes("lavender") ? "eager" : "lazy"}
        fetchPriority={src.includes("lavender") ? "high" : "auto"}
        decoding="async"
        className="h-full w-full object-cover object-center select-none"
      />
      <canvas
        ref={overlayRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 block h-full w-full"
      />
    </div>
  );
}
