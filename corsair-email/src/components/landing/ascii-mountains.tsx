"use client";

import React, { useEffect, useRef } from "react";

interface AsciiMountainsHeroProps {
  theme: "light" | "dark";
  cellSize?: number;
  centerGap?: number;
}

const DENSE_GLYPHS = [".", "·", ":", ";", "+", "*", "▪", "•"];

// Crisp triangular mountain peak with subtle organic facet variation
function ridgeLine(
  u: number,
  peakU: number,
  peakY: number,
  leftSlope: number,
  rightSlope: number,
  seed: number,
  t: number,
) {
  const du = u - peakU;
  const dist = Math.abs(du);
  // Subtle rounded apex (0.004) with straight architectural slopes
  const slope = du < 0 ? leftSlope : rightSlope;
  const linear = peakY + Math.sqrt(dist * dist + 0.00015) * slope;
  // Tiny facet ripple so the line feels hand-crafted, not sine-wavy
  const ripple =
    Math.sin(u * 28 + seed + t * 0.25) * 0.0035 +
    Math.cos(u * 64 - seed * 1.2) * 0.002;
  return linear + ripple;
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const k = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return k * k * (3 - 2 * k);
}

export function AsciiMountainsHero({
  theme,
  cellSize = 6,
  centerGap = 0.28,
}: AsciiMountainsHeroProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    let visible = true;
    let lastFrame = 0;
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = motionQuery.matches;
    const mouse = { x: -9999, y: -9999 };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const onLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };

    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);

    const render = (time: number) => {
      animId = 0;
      if (!visible || document.hidden) return;
      if (!reducedMotion && time - lastFrame < 1000 / 30) {
        animId = requestAnimationFrame(render);
        return;
      }
      lastFrame = time;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) {
        if (!reducedMotion) animId = requestAnimationFrame(render);
        return;
      }

      const isDark = theme === "dark";
      const bg = isDark ? "#000000" : "#f2f1ed";
      const inkRgb = isDark ? "237, 237, 238" : "28, 27, 25";
      const shineRgb = isDark ? "255, 255, 255" : "15, 14, 13";
      const isMobile = w < 640;
      const cell = isMobile ? 6 : cellSize;

      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Soft ambient shine behind the left and right mountain peaks
      if (!isMobile) {
        const glowL = ctx.createRadialGradient(
          w * 0.16,
          h * 0.24,
          4,
          w * 0.16,
          h * 0.28,
          w * 0.26,
        );
        glowL.addColorStop(
          0,
          isDark ? "rgba(255, 255, 255, 0.075)" : "rgba(35, 34, 30, 0.05)",
        );
        glowL.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = glowL;
        ctx.fillRect(0, 0, w * 0.48, h * 0.65);

        const glowR = ctx.createRadialGradient(
          w * 0.84,
          h * 0.25,
          4,
          w * 0.84,
          h * 0.29,
          w * 0.26,
        );
        glowR.addColorStop(
          0,
          isDark ? "rgba(255, 255, 255, 0.075)" : "rgba(35, 34, 30, 0.05)",
        );
        glowR.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = glowR;
        ctx.fillRect(w * 0.52, 0, w * 0.48, h * 0.65);
      }

      // Feathered horizontal atmospheric streaks in upper corners (not full-width lines)
      const streaks = [
        { y: 0.085, x0: 0.03, len: 0.26, a: 0.08 },
        { y: 0.105, x0: 0.01, len: 0.32, a: 0.11 },
        { y: 0.128, x0: 0.05, len: 0.22, a: 0.06 },
        { y: 0.152, x0: 0.02, len: 0.25, a: 0.07 },
      ];
      for (let i = 0; i < streaks.length; i++) {
        const st = streaks[i];
        const sy = Math.floor(h * st.y);
        // Left streak
        const lx0 = w * st.x0;
        const lx1 = w * (st.x0 + st.len);
        const gL = ctx.createLinearGradient(lx0, sy, lx1, sy);
        gL.addColorStop(0, `rgba(${inkRgb}, 0)`);
        gL.addColorStop(0.25, `rgba(${inkRgb}, ${st.a})`);
        gL.addColorStop(0.75, `rgba(${inkRgb}, ${st.a * 0.5})`);
        gL.addColorStop(1, `rgba(${inkRgb}, 0)`);
        ctx.fillStyle = gL;
        ctx.fillRect(lx0, sy, lx1 - lx0, 1.5);

        // Right streak
        const rx1 = w * (1 - st.x0);
        const rx0 = w * (1 - st.x0 - st.len);
        const gR = ctx.createLinearGradient(rx1, sy + 4, rx0, sy + 4);
        gR.addColorStop(0, `rgba(${inkRgb}, 0)`);
        gR.addColorStop(0.25, `rgba(${inkRgb}, ${st.a})`);
        gR.addColorStop(0.75, `rgba(${inkRgb}, ${st.a * 0.5})`);
        gR.addColorStop(1, `rgba(${inkRgb}, 0)`);
        ctx.fillStyle = gR;
        ctx.fillRect(rx0, sy + 4, rx1 - rx0, 1.5);
      }

      if (reducedMotion) time = 0;
      const t = time * 0.0002;
      const cols = Math.floor(w / cell);
      const rows = Math.floor(h / cell);
      const halfGap = centerGap * 0.5;

      ctx.font = `600 ${cell + 1}px ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Shimmer wave travelling slowly across the mountain peaks
      const shimmerPhase = (time * 0.00018) % 1;

      for (let c = 0; c < cols; c++) {
        const px = c * cell + cell / 2;
        const u = px / w;

        let sideMask = 1;
        const ridges: { y: number; depth: number; intensity: number }[] = [];

        if (isMobile) {
          // Mobile: 1 crisp centered mountain behind headline
          sideMask =
            smoothstep(0.02, 0.16, u) * (1 - smoothstep(0.84, 0.98, u));
          ridges.push({
            y: h * ridgeLine(u, 0.5, 0.21, 0.58, 0.58, 1.4, t),
            depth: h * 0.24,
            intensity: 0.92,
          });
          ridges.push({
            y: h * ridgeLine(u, 0.38, 0.33, 0.48, 0.55, 3.6, t),
            depth: h * 0.22,
            intensity: 0.78,
          });
        } else {
          // Desktop: 2 tall, sharp triangular mountain ranges on the left & right flanks
          const distFromCenter = Math.abs(u - 0.5);
          sideMask = smoothstep(halfGap * 0.22, halfGap + 0.14, distFromCenter);
          if (sideMask <= 0.01) continue;

          if (u < 0.5) {
            // 1. Tall Back-Left Peak (aligned with top headline line, u=0.145, y=0.175)
            ridges.push({
              y: h * ridgeLine(u, 0.145, 0.175, 0.68, 0.76, 1.1, t),
              depth: h * 0.21,
              intensity: 0.96,
            });
            // 2. Mid-Left Ridge sloping in from left edge (u=0.0, y=0.225)
            ridges.push({
              y: h * ridgeLine(u, 0.0, 0.225, 0.3, 0.74, 2.7, t),
              depth: h * 0.19,
              intensity: 0.85,
            });
            // 3. Foreground Left Peak (sharp apex at u=0.115, y=0.325, sloping down to u=0.39)
            ridges.push({
              y: h * ridgeLine(u, 0.115, 0.325, 0.76, 0.72, 4.3, t),
              depth: h * 0.26,
              intensity: 1.0,
            });
          }

          if (u > 0.5) {
            // 1. Tall Back-Right Peak (apex at u=0.855, y=0.185)
            ridges.push({
              y: h * ridgeLine(u, 0.855, 0.185, 0.78, 0.64, 3.2, t),
              depth: h * 0.21,
              intensity: 0.96,
            });
            // 2. Mid-Right Sweeping Ridge rising toward right edge (apex at u=0.985, y=0.24)
            ridges.push({
              y: h * ridgeLine(u, 0.985, 0.24, 0.68, 0.3, 5.1, t),
              depth: h * 0.25,
              intensity: 1.0,
            });
            // 3. Foreground Right Shoulder (apex at u=0.89, y=0.365)
            ridges.push({
              y: h * ridgeLine(u, 0.89, 0.365, 0.72, 0.55, 6.8, t),
              depth: h * 0.22,
              intensity: 0.9,
            });
          }
        }

        // Structured vertical matrix column modulation (creates the vertical dot-stream look)
        const colPattern =
          0.72 + 0.28 * Math.cos(c * 1.57 + Math.sin(c * 0.35) * 2.0);

        // Shimmer boost moving across columns
        const shimmerDist = Math.min(
          Math.abs(u - shimmerPhase),
          Math.abs(u - (shimmerPhase - 1)),
          Math.abs(u - (shimmerPhase + 1)),
        );
        const colShine = Math.max(0, 1 - shimmerDist / 0.12) * 0.25;

        for (let r = 0; r < rows; r++) {
          const py = r * cell + cell / 2;
          const ny = py / h;

          // Allow far-left and far-right margin dots to cascade slightly past the top of the lavender card
          const edgeExtend = !isMobile && (u < 0.11 || u > 0.89) ? 0.74 : 0.56;
          const bottomMask = 1 - smoothstep(edgeExtend - 0.12, edgeExtend, ny);
          if (bottomMask <= 0.01) continue;

          let luma = 0;
          let isCrest = false;
          let isNearCrest = false;

          for (let k = 0; k < ridges.length; k++) {
            const rg = ridges[k];
            const dist = py - rg.y;
            if (dist >= -cell * 0.55 && dist < rg.depth) {
              if (dist <= cell * 0.75) {
                luma = Math.max(luma, 1.0 * rg.intensity);
                isCrest = true;
              } else if (dist <= cell * 2.4) {
                luma = Math.max(luma, 0.82 * rg.intensity);
                isNearCrest = true;
              } else {
                const normDist = dist / rg.depth;
                const falloff = Math.pow(1 - normDist, 1.55);
                const rowGrain = 0.78 + 0.22 * Math.cos(r * 1.9 + c * 2.3);
                const val = falloff * colPattern * rowGrain * rg.intensity;
                if (val > luma) luma = val;
              }
            }
          }

          luma *= sideMask * bottomMask;

          if (luma > 0.05) {
            const dx = px - mouse.x;
            const dy = py - mouse.y;
            const d = Math.hypot(dx, dy);
            const push = d < 85 ? (1 - d / 85) * 11 : 0;
            const ox = d > 0 ? (dx / d) * push : 0;
            const oy = d > 0 ? (dy / d) * push : 0;
            const mouseBoost = d < 85 ? (1 - d / 85) * 0.35 : 0;

            if (isCrest) {
              // Specular shining ridge line: bright glowing dot + halo
              const crestAlpha = Math.min(
                1,
                luma * 1.15 + colShine + mouseBoost,
              );
              if (isDark) {
                ctx.fillStyle = `rgba(255, 255, 255, ${(crestAlpha * 0.28).toFixed(3)})`;
                ctx.beginPath();
                ctx.arc(px + ox, py + oy, cell * 0.52, 0, Math.PI * 2);
                ctx.fill();
              }
              ctx.fillStyle = `rgba(${shineRgb}, ${crestAlpha.toFixed(3)})`;
              ctx.beginPath();
              ctx.arc(px + ox, py + oy, isMobile ? 1.35 : 1.55, 0, Math.PI * 2);
              ctx.fill();
            } else {
              // Dense dot & ASCII glyph matrix inside the mountain slope
              const baseAlpha = isDark
                ? Math.min(0.95, luma * 0.92 + colShine + mouseBoost)
                : Math.min(0.95, Math.pow(luma, 0.82) * 0.92 + mouseBoost);
              ctx.fillStyle = `rgba(${inkRgb}, ${baseAlpha.toFixed(3)})`;

              if (isNearCrest || (c + r) % 2 === 0) {
                const radius = Math.max(
                  0.65,
                  Math.min(1.45, luma * (isDark ? 1.35 : 1.45)),
                );
                ctx.beginPath();
                ctx.arc(px + ox, py + oy, radius, 0, Math.PI * 2);
                ctx.fill();
              } else {
                const gIdx = Math.min(
                  DENSE_GLYPHS.length - 1,
                  Math.floor(luma * DENSE_GLYPHS.length),
                );
                ctx.fillText(DENSE_GLYPHS[gIdx], px + ox, py + oy);
              }
            }
          }
        }
      }

      if (!reducedMotion) animId = requestAnimationFrame(render);
    };

    const restart = () => {
      cancelAnimationFrame(animId);
      lastFrame = 0;
      animId = requestAnimationFrame(render);
    };
    const onMotionChange = () => {
      reducedMotion = motionQuery.matches;
      restart();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) restart();
      else cancelAnimationFrame(animId);
    });
    observer.observe(canvas);
    const sizeObserver = new ResizeObserver(() => {
      resize();
      restart();
    });
    sizeObserver.observe(canvas);
    motionQuery.addEventListener("change", onMotionChange);
    document.addEventListener("visibilitychange", restart);
    animId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animId);
      observer.disconnect();
      sizeObserver.disconnect();
      motionQuery.removeEventListener("change", onMotionChange);
      document.removeEventListener("visibilitychange", restart);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseleave", onLeave);
    };
  }, [theme, cellSize, centerGap]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-auto absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  );
}
