"use client";

import Lenis from "lenis";
import { useEffect } from "react";

const panelSelector = ".dashboard-queue, .dashboard-reader, .dashboard-agenda, .dashboard-week-view";

export function SmoothScroll() {
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let dispose = () => {};
    const configure = () => {
      dispose();
      if (preference.matches) return;

      const root = new Lenis({
        autoRaf: true,
        anchors: true,
        allowNestedScroll: true,
        prevent: (node) => document.body.hasAttribute("data-scroll-locked") ||
          Boolean(node.closest('[role="dialog"], [data-lenis-prevent]')),
      });
      const panels = new Map<HTMLElement, Lenis>();
      const syncPanels = () => {
        for (const [element, instance] of panels) {
          if (!element.isConnected) {
            instance.destroy();
            panels.delete(element);
          }
        }
        for (const instance of panels.values()) instance.resize();
        for (const element of document.querySelectorAll<HTMLElement>(panelSelector)) {
          if (!panels.has(element)) {
            panels.set(element, new Lenis({
              wrapper: element,
              content: element,
              autoRaf: true,
              allowNestedScroll: true,
            }));
          }
        }
      };
      syncPanels();
      const observer = new MutationObserver(syncPanels);
      observer.observe(document.body, { childList: true, subtree: true });
      dispose = () => {
        observer.disconnect();
        root.destroy();
        for (const instance of panels.values()) instance.destroy();
        panels.clear();
      };
    };
    configure();
    preference.addEventListener("change", configure);
    return () => {
      preference.removeEventListener("change", configure);
      dispose();
    };
  }, []);
  return null;
}
