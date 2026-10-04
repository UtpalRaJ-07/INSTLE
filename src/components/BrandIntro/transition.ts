/**
 * WebsiteTransition — the film becomes the site.
 *
 * Three things happen together over the handoff:
 *  1. Dawn: the dark scene lifts into the site's paper tone (CSS, .dawn), then
 *     the whole stage dissolves, so the architecture turns into the page behind
 *     it instead of cutting to it.
 *  2. Flight: each part of the large lockup — INSTLE, REAL ESTATE, BENGALURU —
 *     flies to the exact glyph box of the same text in the header lockup, and
 *     changes from lit white to the header's ink as the background turns to
 *     paper. The header's own lockup is hidden until the moment they land.
 *  3. Release: the header lockup is shown, and the overlay is removed.
 *
 * Positions are measured from glyph boxes with Ranges rather than element
 * boxes, so the landing is exact regardless of padding or line height. The
 * motion is Web Animations, which composite above the CSS animations that
 * brought the lockup in, so nothing has to be torn down first.
 */

import { EASE_POINTS, cssCubicBezier } from './timeline';

export interface FlightPart {
  /** The large word in the overlay. */
  word: HTMLElement;
  /** Its lit text layer, whose glyph box is measured. */
  text: HTMLElement;
  /** The layers to fade out as it lands, and the ink layer to fade in. */
  fadeOut: HTMLElement[];
  ink: HTMLElement | null;
  /** Where it lands: a text node in the header lockup and a character range in it. */
  target: Text;
  from: number;
  to: number;
}

function textBox(node: Node, from = 0, to?: number): DOMRect | null {
  const text = node.nodeType === Node.TEXT_NODE ? node : node.firstChild;
  if (!text || text.nodeType !== Node.TEXT_NODE) return null;
  const range = document.createRange();
  range.setStart(text, from);
  range.setEnd(text, to ?? (text.textContent ?? '').length);
  const box = range.getBoundingClientRect();
  return box.width > 0 && box.height > 0 ? box : null;
}

/**
 * Find the header lockup and pair each overlay word with its text there. Returns
 * nothing if the header is not where it is expected, in which case the CSS
 * fallback (fade out, header fades in) runs instead.
 */
export function planFlight(overlay: HTMLElement): FlightPart[] | null {
  const name = document.querySelector<HTMLElement>('header [data-lockup-part="name"]');
  const place = document.querySelector<HTMLElement>('header [data-lockup-part="place"]');
  const nameText = name?.firstChild;
  const placeText = place?.firstChild;
  if (!nameText || !placeText || nameText.nodeType !== Node.TEXT_NODE || placeText.nodeType !== Node.TEXT_NODE) {
    return null;
  }
  const full = nameText.textContent ?? '';

  const parts: FlightPart[] = [];
  for (const word of Array.from(overlay.querySelectorAll<HTMLElement>('[data-intro-part]'))) {
    const text = word.querySelector<HTMLElement>('[data-intro-text]');
    const label = text?.textContent ?? '';
    if (!text || !label) return null;
    const kind = word.dataset.introPart;
    let target: Text;
    let from: number;
    if (kind === 'place') {
      target = placeText as Text;
      from = (placeText.textContent ?? '').indexOf(label);
    } else {
      target = nameText as Text;
      from = full.indexOf(label);
    }
    if (from < 0) return null;
    const ink = word.querySelector<HTMLElement>('[data-layer="ink"]');
    const fadeOut = Array.from(word.querySelectorAll<HTMLElement>('[data-layer]')).filter(
      (layer) => layer.dataset.layer !== 'ink'
    );
    parts.push({ word, text, fadeOut, ink, target, from, to: from + label.length });
  }
  return parts.length > 0 ? parts : null;
}

/** Run the flight. Resolves when every part has landed. */
export function fly(parts: FlightPart[], duration: number): Promise<void> {
  const easing = cssCubicBezier(EASE_POINTS.flight);
  const runs: Promise<unknown>[] = [];
  for (const part of parts) {
    const source = textBox(part.text);
    const target = textBox(part.target, part.from, part.to);
    if (!source || !target) continue;
    const wordBox = part.word.getBoundingClientRect();
    const scale = target.height / source.height;
    const dx = target.left - source.left;
    const dy = target.top - source.top;
    part.word.style.transformOrigin = `${source.left - wordBox.left}px ${source.top - wordBox.top}px`;
    runs.push(
      part.word.animate([{ transform: 'none' }, { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${scale})` }], {
        duration,
        easing,
        fill: 'forwards',
      }).finished
    );
    // Lit white gives way to ink while the background turns to paper.
    const fade = { duration: duration * 0.45, delay: duration * 0.18, easing: 'ease-in-out', fill: 'forwards' as const };
    for (const layer of part.fadeOut) layer.animate([{ opacity: getComputedStyle(layer).opacity }, { opacity: 0 }], fade);
    part.ink?.animate([{ opacity: 0 }, { opacity: 1 }], fade);
  }
  return Promise.all(runs).then(() => undefined);
}
