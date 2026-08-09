import { useEffect, useRef } from 'react';
import { createTimeline, svg } from 'animejs';
import { usePrefersReducedMotion } from '../../lib/motion';

/* ------------------------------------------------------------------ */
/* Sentinel AI — SentinelOrbit                                        */
/* An original, abstract animated SVG glyph: concentric rings draw in, */
/* a central node ignites, and satellites orbit indefinitely. It is   */
/* the visual identity for the autonomous lifecycle — read as "alive   */
/* editorial system", never as a circuit/terminal diagram.            */
/* One-shot reveals run in Anime.js; the continuous orbital spin runs */
/* in CSS (gated to `no-preference`) for a cheap GPU animation.       */
/* ------------------------------------------------------------------ */

interface Props {
  /** Base size in px (square). */
  size?: number;
  className?: string;
  /** Title for assistive tech; omit to treat as decorative. */
  label?: string;
}

export function SentinelOrbit({ size = 220, className = '', label }: Props) {
  const reduced = usePrefersReducedMotion();
  const rootRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || reduced) return;
    let timeline: ReturnType<typeof createTimeline> | undefined;
    try {
      const rings = svg.createDrawable(
        root.querySelectorAll<SVGGeometryElement>('[data-orbit-ring]'),
      );
      const core = root.querySelector('[data-orbit-core]');
      const satellites = root.querySelectorAll('[data-orbit-sat]');
      timeline = createTimeline({ defaults: { ease: 'outExpo' } });
      timeline
        .add(rings, { draw: '0 1', duration: 1500 })
        .add(core as never, { opacity: 1, scale: [0.6, 1], duration: 700, ease: 'outBack' }, '-=1150')
        .add(satellites, {
          opacity: [0, 1],
          scale: [0.5, 1],
          duration: 550,
          stagger: 130,
          ease: 'outBack',
        }, '-=450');
    } catch {
      timeline?.cancel();
    }
    return () => {
      timeline?.cancel();
    };
  }, [reduced]);

  return (
    <span ref={rootRef} className={`orbit ${className}`.trim()} style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 260 260"
        width={size}
        height={size}
        aria-hidden={label ? undefined : true}
        role={label ? 'img' : undefined}
        aria-label={label}
      >
        <defs>
          <linearGradient id="orbit-core" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8b5cf6" />
            <stop offset="1" stopColor="#06b6d4" />
          </linearGradient>
          <linearGradient id="orbit-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#7c3aed" />
            <stop offset="0.5" stopColor="#3b82f6" />
            <stop offset="1" stopColor="#ec4899" />
          </linearGradient>
        </defs>

        {/* Ring tracks — drawn in by Anime.js on mount */}
        <circle data-orbit-ring cx="130" cy="130" r="58" fill="none" stroke="url(#orbit-ring)" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
        <circle data-orbit-ring cx="130" cy="130" r="92" fill="none" stroke="url(#orbit-ring)" strokeWidth="2" strokeDasharray="3 9" strokeLinecap="round" opacity="0.7" />

        {/* Outer satellite — spins via CSS (reduced-motion gated) */}
        <g data-orbit-spin="outer">
          <g transform="translate(130 130)">
            <circle data-orbit-sat cx="0" cy="-92" r="7" fill="#8b5cf6" />
            <circle data-orbit-sat cx="0" cy="-92" r="13" fill="none" stroke="rgba(139,92,246,0.38)" strokeWidth="2" />
          </g>
        </g>

        {/* Inner counter-rotating satellite */}
        <g data-orbit-spin="inner">
          <g transform="translate(130 130)">
            <circle data-orbit-sat cx="0" cy="-58" r="4.5" fill="#06b6d4" />
            <circle data-orbit-sat cx="0" cy="-58" r="10" fill="none" stroke="rgba(6,182,212,0.45)" strokeWidth="1.5" />
          </g>
        </g>

        {/* Core node — ignites */}
        <g data-orbit-core>
          <circle cx="130" cy="130" r="30" fill="url(#orbit-core)" opacity="0.16" />
          <circle cx="130" cy="130" r="20" fill="url(#orbit-core)" />
          <circle cx="130" cy="130" r="8" fill="#ffffff" />
        </g>
      </svg>
    </span>
  );
}

export default SentinelOrbit;