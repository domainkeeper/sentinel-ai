import { useEffect } from 'react';

/**
 * Fixed, full-screen ambient backdrop. Layered, cheap, GPU-friendly:
 * base -> screen-blended aurora orbs -> conic wash -> grid/dots ->
 * noise -> scan -> vignette -> pointer spotlight. All decorative and
 * `aria-hidden`. Motion is transform/filter only and is fully crashed
 * under `prefers-reduced-motion` (see ambient.css).
 */
export function AmbientBackground() {
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function' ||
      !window.matchMedia('(pointer: fine)').matches
    ) {
      return;
    }
    const root = document.documentElement;

    const onMove = (e: PointerEvent) => {
      root.style.setProperty('--spot-x', `${e.clientX}px`);
      root.style.setProperty('--spot-y', `${e.clientY}px`);
    };

    // Subtle parallax: the engineering grid descends slightly with scroll.
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = Math.min(window.scrollY, 240);
        root.style.setProperty('--parallax-speed', `${y * 0.18}px`);
      });
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="ambient" aria-hidden="true">
      <div className="ambient__base" />
      <div className="ambient__aurora ambient__aurora--a" />
      <div className="ambient__aurora ambient__aurora--b" />
      <div className="ambient__aurora ambient__aurora--c" />
      <div className="ambient__aurora ambient__aurora--d" />
      <div className="ambient__conic" />
      <div className="ambient__grid" />
      <div className="ambient__dots" />
      <div className="ambient__noise" />
      <div className="ambient__scan" />
      <div className="ambient__vignette" />
      <div className="ambient__spotlight" />
    </div>
  );
}

export default AmbientBackground;