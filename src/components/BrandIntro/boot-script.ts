/**
 * The boot script: the only part of the intro that runs before first paint.
 *
 * It is inlined in the root layout's <head>, so it runs while the HTML is still
 * being parsed, before anything is drawn. It has four jobs and nothing else:
 *
 *  1. Decide the mode — full film, reduced-motion still, a brief returning-visit
 *     sweep, or nothing — and write it onto <html>. The CSS keys every layer off
 *     that attribute, so the overlay is on screen from the very first frame and
 *     the site never flashes up underneath it.
 *  2. Write the resolved timeline onto <html> as custom properties.
 *  3. Let the first key, press, wheel or touch-move skip the film, even before
 *     React has hydrated.
 *  4. Stay out of the way everywhere else: it does nothing off the homepage, for
 *     crawlers, or when the intro is switched off.
 *
 * Returning visits are recognised without storing anything: a reload, a
 * back/forward navigation, or a referrer on this site's own origin. What they
 * get is INTRO_CONFIG.returningVisit — by owner request, the full film again.
 * Nothing is stored either way: the public surface uses no client storage
 * (tests/public-content.test.ts).
 */

import { INTRO_CONFIG, resolveStillTimeline, resolveTimeline, type IntroMode } from './intro-config';
import { MODE_ATTRIBUTE, SKIP_ATTRIBUTE, timelineCssVariables } from './timeline';

export function buildIntroBootScript(): string {
  if (!INTRO_CONFIG.enabled) return '';

  const modes: IntroMode[] = ['full', 'still', 'brief'];
  const variables = Object.fromEntries(modes.map((mode) => [mode, timelineCssVariables(mode)]));
  const totals = {
    full: resolveTimeline().total,
    still: resolveStillTimeline().total,
    brief: INTRO_CONFIG.brief.total,
  };
  // 'full' plays the whole film on a reload or back/forward too.
  const returning = INTRO_CONFIG.returningVisit === 'none' ? '' : INTRO_CONFIG.returningVisit;
  const reduced = INTRO_CONFIG.reducedMotion === 'still' ? 'still' : '';

  // ES5 on purpose: this runs before any polyfill or bundle, on every browser.
  return [
    '(function(){try{',
    'var d=document.documentElement,w=window,l=w.location;',
    'if(l.pathname!=="/")return;',
    'if(/bot|crawl|spider|slurp/i.test(navigator.userAgent||""))return;',
    `var V=${JSON.stringify(variables)},T=${JSON.stringify(totals)};`,
    'var go=function(){',
    'var q=w.matchMedia&&w.matchMedia("(prefers-reduced-motion: reduce)").matches;',
    'var e=w.performance&&performance.getEntriesByType?performance.getEntriesByType("navigation")[0]:null;',
    'var k=e?e.type:"navigate",o=false;',
    'try{o=!!document.referrer&&new URL(document.referrer).origin===l.origin}catch(x){}',
    `var m=q?"${reduced}":((k==="reload"||k==="back_forward"||o)?"${returning}":"full");`,
    'if(!m)return;',
    'var v=V[m];for(var p in v)d.style.setProperty(p,v[p]);',
    `d.setAttribute("${MODE_ATTRIBUTE}",m);`,
    // The brief sweep is CSS only; tidy the attribute away once it has run.
    `if(m==="brief"){setTimeout(function(){d.removeAttribute("${MODE_ATTRIBUTE}")},T.brief+100);return}`,
    'var n=["pointerdown","keydown","wheel","touchmove"],',
    'off=function(){for(var i=0;i<n.length;i++)w.removeEventListener(n[i],s,true)},',
    // A press that skips must not also activate whatever sits under the film:
    // swallow the click that follows it.
    'eat=function(c){c.preventDefault();c.stopPropagation();w.removeEventListener("click",eat,true)},',
    `s=function(e){d.setAttribute("${SKIP_ATTRIBUTE}","");off();`,
    'if(e&&e.type==="pointerdown"){w.addEventListener("click",eat,true);setTimeout(function(){w.removeEventListener("click",eat,true)},800)}};',
    'for(var i=0;i<n.length;i++)w.addEventListener(n[i],s,{capture:true,passive:true});',
    'setTimeout(off,T[m]+200)};',
    'if(document.prerendering)document.addEventListener("prerenderingchange",go,{once:true});else go()',
    '}catch(x){}})();',
  ].join('');
}
