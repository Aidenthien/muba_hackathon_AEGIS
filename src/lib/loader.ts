"use client";

/**
 * Tiny pub/sub for the preloader lifecycle. The intro animations (hero,
 * navbar) and Lenis scrolling stay parked until the preloader finishes.
 */
let done = false;
const subscribers: (() => void)[] = [];

export function markLoaded() {
  if (done) return;
  done = true;
  subscribers.splice(0).forEach((fn) => fn());
}

export function onLoaded(fn: () => void) {
  if (done) fn();
  else subscribers.push(fn);
}
