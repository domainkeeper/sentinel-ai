import { useInView } from '../../lib/useInView';

/**
 * Kinetic headline: each word rises into place with a stagger once in view,
 * driven by the CSS `--word-i` index and `is-visible`. Falls back to plain
 * text if IntersectionObserver / JS isn't available.
 */
export function RevealText({ text, className = '' }: { text: string; className?: string }) {
  const { ref, inView } = useInView<HTMLSpanElement>({ threshold: 0.3 });
  const words = text.split(' ');

  return (
    <span ref={ref} className={`kinetic ${inView ? 'is-visible' : ''} ${className}`.trim()} aria-label={text}>
      {words.map((word, i) => (
        <span key={i} className="kinetic__word" style={{ ['--word-i' as string]: i }}>
          {word}
        </span>
      ))}
    </span>
  );
}

export default RevealText;