import { useEffect, useRef, useState } from 'react';

/**
 * Jumpscare overlay — ported from flutter_game/lib/ui/widgets/jumpscare_overlay.dart.
 *
 * The Flutter original drives an AnimationController and rebuilds every frame with:
 *   phase = t * duration.inMilliseconds * 0.085
 *   amp   = 18 * (1 - t * 0.25)
 *   dx    = sin(phase * 1.7) * amp
 *   dy    = cos(phase * 2.3) * amp * 0.85
 *   tilt  = sin(phase * 1.3) * 0.045
 *   zoom  = 1.12 + abs(sin(phase * 0.9)) * 0.12
 * over a radial blood gradient. This reproduces that math with
 * requestAnimationFrame, honours prefers-reduced-motion, and calls onFinished
 * once the animation completes.
 */
const SCARE_BY_GHOST: Record<string, string> = {
  'Shadow Figure': '/backrooms/jumpscare.jpg',
  'White Lady': '/backrooms/jumpscare.jpg',
  Tiyanak: '/backrooms/jumpscare.jpg',
  Kapre: '/backrooms/jumpscare.jpg',
  'The Head Nurse': '/backrooms/jumpscare.jpg',
  Manananggal: '/backrooms/jumpscare.jpg',
};

export const jumpscareFor = (ghost?: string) =>
  (ghost && SCARE_BY_GHOST[ghost]) || '/backrooms/jumpscare.jpg';

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduce(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return reduce;
}

export function JumpscareOverlay({
  imageSrc = '/backrooms/jumpscare.jpg',
  duration = 3200,
  onFinished,
}: {
  imageSrc?: string;
  duration?: number;
  onFinished?: () => void;
}) {
  const [t, setT] = useState(0);
  const reduce = usePrefersReducedMotion();
  const done = useRef(false);
  const finish = useRef(onFinished);
  finish.current = onFinished;

  useEffect(() => {
    done.current = false;
    const start = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setT(p);
      if (p < 1) raf = requestAnimationFrame(loop);
      else if (!done.current) {
        done.current = true;
        finish.current?.();
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [duration]);

  const phase = t * duration * 0.085;
  const amp = reduce ? 0 : 18 * (1 - t * 0.25);
  const dx = Math.sin(phase * 1.7) * amp;
  const dy = Math.cos(phase * 2.3) * amp * 0.85;
  const tilt = reduce ? 0 : Math.sin(phase * 1.3) * 0.045;
  const zoom = reduce ? 1 : 1.12 + Math.abs(Math.sin(phase * 0.9)) * 0.12;

  return (
    <div className="scare" role="alert" aria-label="Caught">
      <div
        className="scare-plate"
        style={{ transform: `translate3d(${dx}px, ${dy}px, 0) rotate(${tilt}rad) scale(${zoom})` }}
      >
        <img src={imageSrc} alt="" />
      </div>
      <div className="scare-blood" style={{ opacity: 0.25 + Math.abs(Math.sin(phase)) * 0.25 }} />
      <div className="scare-flash" style={{ opacity: Math.max(0, 0.85 - t * 12) }} />
      <p className="scare-caption">feed terminated</p>
    </div>
  );
}
