import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Every `title` in the app, shown as a Material tooltip instead of the browser's.
 *
 * The editor explains itself in hundreds of `title`s — what a control does, its shortcut.
 * The native tooltip is slow, tiny and unstyled, which is where a beginner looks first.
 * Rather than rewrite each control, this one listener lifts the title off whatever the
 * pointer (or keyboard focus) rests on, shows it, and puts it back on the way out — so the
 * markup, the tests and screen readers keep reading the same attribute.
 *
 * Once one tooltip has shown, the next appears at once (a "warm" pass along a toolbar),
 * the way every desktop tool behaves.
 */
let mounted = 0;
const DELAY = 450;
const WARM_MS = 500;

export function Tooltips() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number; below: boolean } | null>(null);

  useEffect(() => {
    // one per page: the editor and the dashboard shell may both render it
    if (mounted++) return () => { mounted--; };
    let el: HTMLElement | null = null;
    let text = '';
    let timer = 0;
    let lastHidden = 0;
    // a control you just pressed keeps quiet until you leave it — its menu is open now
    let pressed: Element | null = null;

    const hide = () => {
      clearTimeout(timer);
      if (el && text && !el.hasAttribute('title')) el.setAttribute('title', text);
      if (el) lastHidden = performance.now();
      el = null; text = '';
      setTip(null);
    };
    const show = (target: HTMLElement) => {
      const r = target.getBoundingClientRect();
      if (!r.width && !r.height) return;
      const below = r.bottom + 44 < window.innerHeight;
      setTip({ text, x: r.left + r.width / 2, y: below ? r.bottom + 8 : r.top - 8, below });
    };
    const arm = (target: HTMLElement) => {
      if (target === el || target === pressed) return;
      hide();
      const t = target.getAttribute('title');
      if (!t) return;
      el = target; text = t;
      // lifted now, not when shown, or the browser's own tooltip wins the race
      target.removeAttribute('title');
      const warm = performance.now() - lastHidden < WARM_MS;
      timer = window.setTimeout(() => el === target && show(target), warm ? 0 : DELAY);
    };

    const over = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const target = (e.target as Element | null)?.closest?.('[title]') as HTMLElement | null;
      if (target) arm(target);
      else if (el && !el.contains(e.target as Node)) hide();
    };
    const out = (e: PointerEvent) => {
      if (el && !el.contains(e.relatedTarget as Node | null)) hide();
      if (pressed && !pressed.contains(e.relatedTarget as Node | null)) pressed = null;
    };
    const down = (e: PointerEvent) => {
      pressed = el ?? ((e.target as Element | null)?.closest?.('[title]') ?? null);
      hide();
    };
    const focus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.matches?.(':focus-visible') && target.hasAttribute('title')) arm(target);
    };

    document.addEventListener('pointerover', over, true);
    document.addEventListener('pointerout', out, true);
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('focusin', focus);
    document.addEventListener('focusout', hide);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('keydown', hide, true);
    return () => {
      mounted--;
      hide();
      document.removeEventListener('pointerover', over, true);
      document.removeEventListener('pointerout', out, true);
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('focusin', focus);
      document.removeEventListener('focusout', hide);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('keydown', hide, true);
    };
  }, []);

  if (!tip) return null;
  return createPortal(
    <div className="m3-tooltip" role="tooltip" data-below={tip.below} style={{ left: tip.x, top: tip.y }}
      // centred on the control, then nudged back inside the window if that pushed it off an edge
      ref={(node) => {
        if (!node) return;
        const r = node.getBoundingClientRect();
        const dx = r.left < 8 ? 8 - r.left : r.right > window.innerWidth - 8 ? window.innerWidth - 8 - r.right : 0;
        if (dx) node.style.marginLeft = `${dx}px`;
      }}>
      {tip.text}
    </div>,
    document.body,
  );
}
