import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '../../lib/motion';

/* ------------------------------------------------------------------ */
/* Sentinel AI — InteractiveDotGrid                                   */
/* Themed take on the React Bits "DotGrid" effect: a canvas of base    */
/* dots that light toward the accent colour near the cursor and ripple */
/* outwards (shockwave) on fast pointer moves. Serves as the living   */
/* colour layer of the background. Depends on one rAF loop and is      */
/* DPR-capped + ResizeObserver-cleared + auto-paused when hidden.     */
/*                                                                    */
/* Under `prefers-reduced-motion`, or when the pointer is not fine,   */
/* a single static grid is drawn and no animation loop runs.          */
/* Decorative — parent sets aria-hidden.                              */
/* ------------------------------------------------------------------ */

interface DotProps {
  activeColor?: string;
  baseColor?: string;
  dotSize?: number;
  gap?: number;
  proximity?: number;
  shockRadius?: number;
  shockStrength?: number;
  speedTrigger?: number;
  maxSpeed?: number;
  resistance?: number;
  returnDuration?: number;
}

interface Shock {
  x: number;
  y: number;
  r: number;
  maxR: number;
  strength: number;
}

interface Dot {
  x: number;
  y: number;
  dx: number;
  dy: number;
  tx: number;
  ty: number;
}

const TAU = Math.PI * 2;

export function InteractiveDotGrid({
  activeColor = '#7c3aed',
  baseColor = 'rgba(25, 26, 31, 0.12)',
  dotSize = 5,
  gap = 15,
  proximity = 120,
  shockRadius = 250,
  shockStrength = 6,
  speedTrigger = 100,
  maxSpeed = 5000,
  resistance = 0.9,
  returnDuration = 1.5,
}: DotProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = prefersReducedMotion();
    const canTrack =
      typeof window !== 'undefined' &&
      typeof window.PointerEvent !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: fine)').matches;
    const still = reduced || !canTrack;

    let raf = 0;
    let width = 0;
    let height = 0;
    let dots: Dot[] = [];
    const shocks: Shock[] = [];
    let px = -9999;
    let py = -9999;
    let lastX = -9999;
    let lastY = -9999;
    let lastT = 0;
    let visible = true;

    const layout = () => {
      dots = [];
      const cols = Math.max(0, Math.floor((width + gap) / gap));
      const rows = Math.max(0, Math.floor((height + gap) / gap));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          dots.push({ x: c * gap + gap / 2, y: r * gap + gap / 2, dx: 0, dy: 0, tx: 0, ty: 0 });
        }
      }
    };

    const paintStatic = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = baseColor;
      for (const d of dots) {
        ctx.beginPath();
        ctx.arc(d.x, d.y, dotSize / 2, 0, TAU);
        ctx.fill();
      }
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      layout();
      if (still) paintStatic();
    };

    const onPointer = (e: PointerEvent) => {
      const now = performance.now();
      const dt = Math.max(1, now - lastT);
      const speed = Math.hypot(e.clientX - lastX, e.clientY - lastY) / dt * 1000;
      if (speed > speedTrigger) {
        shocks.push({
          x: e.clientX,
          y: e.clientY,
          r: 10,
          maxR: shockRadius,
          strength: (Math.min(speed, maxSpeed) / maxSpeed) * shockStrength,
        });
      }
      px = e.clientX;
      py = e.clientY;
      lastX = e.clientX;
      lastY = e.clientY;
      lastT = now;
    };

    const frame = () => {
      if (visible) {
        ctx.clearRect(0, 0, width, height);

        // Proximity nudges.
        const prox2 = proximity * proximity;
        for (const d of dots) {
          const dxs = px - d.x;
          const dys = py - d.y;
          const dist2 = dxs * dxs + dys * dys;
          if (dist2 < prox2) {
            const dist = Math.sqrt(dist2) || 0.001;
            const t = (proximity - dist) / proximity;
            d.tx += (dxs / dist) * t * 0.6;
            d.ty += (dys / dist) * t * 0.6;
          }
        }

        // Expand + apply shockwaves, aging them out.
        for (let i = shocks.length - 1; i >= 0; i--) {
          const s = shocks[i];
          s.r += 7;
          if (s.r >= s.maxR) {
            shocks.splice(i, 1);
            continue;
          }
          const band = 46;
          for (const d of dots) {
            const dxs = d.x - s.x;
            const dys = d.y - s.y;
            const dist = Math.hypot(dxs, dys);
            if (dist > s.r - band && dist < s.r + band) {
              const falloff = (band - Math.abs(dist - s.r)) / band;
              const dirx = dxs / (dist || 0.001);
              const diry = dys / (dist || 0.001);
              const mag = s.strength * falloff;
              d.tx += dirx * mag;
              d.ty += diry * mag;
            }
          }
        }

        // Integrate toward targets + render.
        const drop = Math.min(1, returnDuration / 3);
        for (const d of dots) {
          const damp = Math.max(0, 1 - resistance * 0.02);
          d.tx *= damp;
          d.ty *= damp;
          d.dx += (d.tx - d.dx) * drop;
          d.dy += (d.ty - d.dy) * drop;
          const off = Math.hypot(d.dx, d.dy);
          ctx.beginPath();
          ctx.arc(d.x + d.dx, d.y + d.dy, dotSize / 2, 0, TAU);
          if (off > 0.3) {
            ctx.fillStyle = activeColor;
            ctx.globalAlpha = Math.min(1, off / proximity) * 0.85;
            ctx.fill();
            ctx.globalAlpha = 1;
          } else {
            ctx.fillStyle = baseColor;
            ctx.fill();
          }
        }
      }
      raf = requestAnimationFrame(frame);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const onVis = () => {
      visible = document.visibilityState === 'visible';
    };
    document.addEventListener('visibilitychange', onVis);

    if (still) {
      resize();
      return () => {
        ro.disconnect();
        document.removeEventListener('visibilitychange', onVis);
      };
    }

    resize();
    window.addEventListener('pointermove', onPointer, { passive: true });
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', onVis);
      ro.disconnect();
    };
  }, [activeColor, baseColor, dotSize, gap, proximity, shockRadius, shockStrength, speedTrigger, maxSpeed, resistance, returnDuration]);

  return <canvas ref={ref} className="dotgrid" data-dotgrid />;
}

export default InteractiveDotGrid;