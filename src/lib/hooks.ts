"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** True after hydration, without a setState-in-effect. */
export const useMounted = () => useSyncExternalStore(noop, () => true, () => false);

const mediaSubscribe = (query: string) => (cb: () => void) => {
  const mq = window.matchMedia(query);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

export const useMediaQuery = (query: string, serverValue = false) =>
  useSyncExternalStore(mediaSubscribe(query), () => window.matchMedia(query).matches, () => serverValue);

export const useReducedMotion = () => useMediaQuery("(prefers-reduced-motion: reduce)");
export const useCoarsePointer = () => useMediaQuery("(pointer: coarse)");
export const useNarrow = () => useMediaQuery("(max-width: 767px)");

/** Shared 1 s clock; 0 on the server so nothing temporal lands in the HTML. */
let cachedNow = 0;
const clockListeners = new Set<() => void>();
let clockTimer: ReturnType<typeof setInterval> | undefined;
const clockSubscribe = (cb: () => void) => {
  clockListeners.add(cb);
  if (!clockTimer) {
    cachedNow = Date.now();
    clockTimer = setInterval(() => {
      cachedNow = Date.now();
      clockListeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    clockListeners.delete(cb);
    if (clockListeners.size === 0 && clockTimer) {
      clearInterval(clockTimer);
      clockTimer = undefined;
    }
  };
};
export const useNow = () => useSyncExternalStore(clockSubscribe, () => cachedNow || Date.now(), () => 0);

const visibilitySubscribe = (cb: () => void) => {
  document.addEventListener("visibilitychange", cb);
  return () => document.removeEventListener("visibilitychange", cb);
};
export const usePageVisible = () => useSyncExternalStore(visibilitySubscribe, () => !document.hidden, () => true);

const scrollSubscribe = (cb: () => void) => {
  window.addEventListener("scroll", cb, { passive: true });
  return () => window.removeEventListener("scroll", cb);
};
export const useScrolled = (threshold = 8) => useSyncExternalStore(scrollSubscribe, () => window.scrollY > threshold, () => false);
