import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { sub2 } from './Typo';

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/** True once the element has entered the viewport (plays once). */
export function useInViewOnce<T extends Element>(rootMargin = '0px 0px -10% 0px') {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        // Also reveal anything already scrolled past (e.g. after a jump or an anchor link).
        if (entries.some((e) => e.isIntersecting || e.boundingClientRect.top < 0)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView, rootMargin]);
  return { ref, inView };
}

/** Headline revealed line by line through overflow masks. */
export function MaskLines({ lines, className = '', as: Tag = 'h2', delay = 0 }: { lines: ReactNode[]; className?: string; as?: 'h1' | 'h2' | 'h3' | 'p' | 'div'; delay?: number }) {
  const { ref, inView } = useInViewOnce<HTMLHeadingElement>();
  return (
    <Tag ref={ref as never} className={`${className} ${inView ? 'is-in' : ''}`}>
      {lines.map((l, i) => (
        <span key={i} className="mask-line" style={{ '--i': i + delay } as CSSProperties}>
          <span>{typeof l === 'string' ? sub2(l) : l}</span>
        </span>
      ))}
    </Tag>
  );
}

/** Children revealed one after another (opacity + 12px translate). */
export function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const { ref, inView } = useInViewOnce<HTMLDivElement>();
  return (
    <div ref={ref} className={`reveal ${inView ? 'is-in' : ''} ${className}`}>
      {children}
    </div>
  );
}

/** Figures and tables: one horizontal wipe. */
export function Wipe({ children, className = '' }: { children: ReactNode; className?: string }) {
  const { ref, inView } = useInViewOnce<HTMLDivElement>();
  return (
    <div ref={ref} className={`wipe ${inView ? 'is-in' : ''} ${className}`}>
      {children}
    </div>
  );
}

/** Number that counts up once when it enters the viewport. Renders the final value without JS. */
export function CountUp({ value, format = (n) => String(Math.round(n)), duration = 900 }: { value: number; format?: (n: number) => string; duration?: number }) {
  const { ref, inView } = useInViewOnce<HTMLSpanElement>();
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (!inView) return;
    if (prefersReducedMotion()) {
      setShown(value);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(value * eased);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    setShown(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration]);
  return (
    <span ref={ref} className="tabular">
      {format(shown ?? value)}
    </span>
  );
}
