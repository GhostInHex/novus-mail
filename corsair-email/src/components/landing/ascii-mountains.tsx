"use client";

import { useEffect, useRef } from "react";
import {
  createMountainPainter,
  type MountainCommand,
  type MountainPointer,
  type MountainSettings,
} from "./mountain-painter";

interface AsciiMountainsHeroProps {
  theme: "light" | "dark";
  cellSize?: number;
  centerGap?: number;
}

export function AsciiMountainsHero({
  theme,
  cellSize = 6,
  centerGap = 0.28,
}: AsciiMountainsHeroProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // A fresh canvas also makes transfer safe across Strict Mode effect replays.
    let canvas = document.createElement("canvas");
    canvas.className = "absolute inset-0 h-full w-full";
    host.replaceChildren(canvas);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const settings: MountainSettings = {
      width: host.clientWidth,
      height: host.clientHeight,
      theme,
      cellSize,
      centerGap,
      reducedMotion: motion.matches,
    };
    let pointer: MountainPointer = { x: -9999, y: -9999, active: false };
    let worker: Worker | undefined;
    let paint: ReturnType<typeof createMountainPainter> | undefined;
    let frame = 0;
    let lastFrame = 0;
    let pointerFrame = 0;
    let visible = true;
    let disposed = false;
    const ratio = () => Math.min(window.devicePixelRatio || 1, 1.5);
    const send = (command: MountainCommand, transfer: Transferable[] = []) =>
      worker?.postMessage(command, transfer);
    const render = (time: number) => {
      frame = 0;
      if (!visible || document.hidden) return;
      if (time - lastFrame >= 1000 / 24 || settings.reducedMotion) {
        paint?.(settings, pointer, time);
        lastFrame = time;
      }
      if (!settings.reducedMotion) frame = requestAnimationFrame(render);
    };
    const restart = () => {
      cancelAnimationFrame(frame);
      lastFrame = 0;
      if (paint) frame = requestAnimationFrame(render);
    };
    const resize = () => {
      settings.width = host.clientWidth;
      settings.height = host.clientHeight;
      if (worker)
        send({
          type: "resize",
          width: settings.width,
          height: settings.height,
          pixelRatio: ratio(),
        });
      else {
        canvas.width = Math.round(settings.width * ratio());
        canvas.height = Math.round(settings.height * ratio());
        canvas.getContext("2d")?.setTransform(ratio(), 0, 0, ratio(), 0, 0);
        restart();
      }
    };
    const fallback = () => {
      if (disposed) return;
      worker?.terminate();
      worker = undefined;
      // A transferred canvas cannot be reclaimed for the main-thread fallback.
      canvas = document.createElement("canvas");
      canvas.className = "absolute inset-0 h-full w-full";
      host.replaceChildren(canvas);
      settings.cellSize = Math.max(cellSize, 9);
      const ctx = canvas.getContext("2d");
      if (ctx) paint = createMountainPainter(ctx);
      resize();
      host.dataset.renderer = "main";
    };
    try {
      if (typeof Worker !== "undefined" && canvas.transferControlToOffscreen) {
        worker = new Worker(
          new URL("./ascii-mountains.worker.ts", import.meta.url),
        );
        worker.onerror = fallback;
        const offscreen = canvas.transferControlToOffscreen();
        send(
          { type: "init", canvas: offscreen, settings, pixelRatio: ratio() },
          [offscreen],
        );
        host.dataset.renderer = "worker";
      } else fallback();
    } catch {
      fallback();
    }

    const updatePointer = () => {
      pointerFrame = 0;
      send({ type: "pointer", pointer });
    };
    const onMove = (event: PointerEvent) => {
      if (!visible || settings.reducedMotion) return;
      const rect = host.getBoundingClientRect();
      pointer = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        active:
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom,
      };
      if (!pointerFrame) pointerFrame = requestAnimationFrame(updatePointer);
    };
    const onLeave = () => {
      pointer = { ...pointer, active: false };
      updatePointer();
    };
    const onPointerOut = (event: PointerEvent) => {
      if (!event.relatedTarget) onLeave();
    };
    const updateVisibility = () => {
      send({ type: "visibility", visible: visible && !document.hidden });
      restart();
    };
    const onMotion = () => {
      settings.reducedMotion = motion.matches;
      send({ type: "motion", reducedMotion: settings.reducedMotion });
      restart();
    };
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      updateVisibility();
    });
    intersection.observe(host);
    const sizeObserver = new ResizeObserver(resize);
    sizeObserver.observe(host);
    motion.addEventListener("change", onMotion);
    document.addEventListener("visibilitychange", updateVisibility);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerout", onPointerOut);
    window.addEventListener("blur", onLeave);
    return () => {
      disposed = true;
      worker?.terminate();
      cancelAnimationFrame(frame);
      cancelAnimationFrame(pointerFrame);
      intersection.disconnect();
      sizeObserver.disconnect();
      motion.removeEventListener("change", onMotion);
      document.removeEventListener("visibilitychange", updateVisibility);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerout", onPointerOut);
      window.removeEventListener("blur", onLeave);
      host.replaceChildren();
    };
  }, [theme, cellSize, centerGap]);
  return (
    <div
      ref={hostRef}
      data-ascii-mountains
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  );
}
