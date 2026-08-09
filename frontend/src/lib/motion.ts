/* ------------------------------------------------------------------ */
/* Sentinel AI — motion helpers.                                      */
/* A single source of truth for `prefers-reduced-motion` so every     */
/* animation (CSS or Anime.js) can be neutralised consistently and    */
/* cheaply. Returns true when the preference is set OR the Media      */
/* Query API is unavailable (e.g. Node/jsdom) — in both cases callers */
/* render a static, safe state and skip imperative animation.         */
/* ------------------------------------------------------------------ */

import { useSyncExternalStore } from 'react';

function subscribe(cb: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
  mql.addEventListener('change', cb);
  return () => mql.removeEventListener('change', cb);
}

function getSnapshot(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * True when the user prefers reduced motion (or the Media Query API is
 * unavailable). Follows the preference live via a subscription.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}

/** Same check without React — for imperative effects/startup logic. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
