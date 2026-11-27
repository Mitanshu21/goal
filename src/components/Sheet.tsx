import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Bottom sheet that slides up over the current page.
 * Closes on backdrop tap, Escape, or dragging it down.
 */
export default function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const sheet = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  // Drag down to close. Starts only when the sheet is scrolled to the top and
  // the finger isn't in a text box, so normal scrolling and typing still work.
  useEffect(() => {
    const el = sheet.current;
    if (!el) return;
    let startY = 0, startT = 0, dy = 0;
    let state: 'idle' | 'maybe' | 'drag' = 'idle';

    const move = (y: number) => {
      el.style.transform = `translateY(${y}px)`;
      if (scrim.current) scrim.current.style.opacity = String(Math.max(0, 1 - y / (el.offsetHeight || 1)));
    };
    const onStart = (e: TouchEvent) => {
      const t = e.target as HTMLElement;
      if (e.touches.length !== 1 || t.closest('textarea, input, select')) { state = 'idle'; return; }
      startY = e.touches[0].clientY; startT = Date.now(); dy = 0;
      state = el.scrollTop <= 0 ? 'maybe' : 'idle';
    };
    const onMove = (e: TouchEvent) => {
      if (state === 'idle') return;
      dy = e.touches[0].clientY - startY;
      if (state === 'maybe') {
        if (dy < 6) { if (dy < -6) state = 'idle'; return; } // moving up = normal scroll
        state = 'drag';
        el.classList.remove('settling');
        el.classList.add('dragging');
        el.style.animation = 'none';
      }
      e.preventDefault(); // stops the page from scrolling or refreshing
      move(Math.max(0, dy));
    };
    const onEnd = () => {
      if (state !== 'drag') { state = 'idle'; return; }
      state = 'idle';
      el.classList.remove('dragging');
      el.classList.add('settling');
      const fast = dy > 40 && dy / Math.max(1, Date.now() - startT) > 0.5;
      if (dy > Math.min(140, el.offsetHeight * 0.3) || fast) {
        move(el.offsetHeight);
        window.setTimeout(() => closeRef.current(), 200);
      } else {
        move(0);
      }
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  return (
    <>
      <div className="scrim" ref={scrim} onClick={onClose} />
      <div className="sheet" ref={sheet} role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </>
  );
}
