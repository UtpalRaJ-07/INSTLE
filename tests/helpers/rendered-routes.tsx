/**
 * Every public route, rendered to the markup the server sends.
 *
 * One map from route to page component, and one way of reading links out of the
 * result, so the link rules of Requirement 8 are checked against what a crawler
 * receives rather than against fixtures. The route list itself is not kept here:
 * callers take it from `getPublicRoutes`, and `renderRouteContent` throws for a
 * route it has no page for, so a newly published route type cannot be skipped.
 *
 * `renderRouteContent` returns the page's own content — what the route renders
 * inside `<main>` — and `renderShell` the layout around it. The two are kept apart
 * because Requirement 8.7 counts call actions over the page's content, while the
 * link-text rule of 8.2 holds for every link on the page, shell included.
 *
 * DOM helpers need a document: call them from a `@vitest-environment jsdom` file.
 * A test that renders `MobileActionBar` must mock `usePathname`.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { notFound, permanentRedirect } from 'next/navigation';

import HomePage from '@/app/page';
import BuyPage from '@/app/buy/page';
import SellPage from '@/app/sell/page';
import RentPage from '@/app/rent/page';
import RentOutPage from '@/app/rent-out/page';
import CommercialPage from '@/app/commercial/page';
import AreasPage from '@/app/areas/page';
import GuidesPage from '@/app/guides/page';
import HowItWorksPage from '@/app/how-it-works/page';
import AboutPage from '@/app/about/page';
import OwnerProfilePage from '@/app/about/utpal-raj-kb/page';
import ContactPage from '@/app/contact/page';
import LocalityPage from '@/app/areas/[slug]/page';
import GuidePage from '@/app/guides/[slug]/page';
import { Header } from '@/components/Header/Header';
import { Footer } from '@/components/Footer/Footer';
import { MobileActionBar } from '@/components/MobileActionBar/MobileActionBar';
import { SkipLink } from '@/components/SkipLink/SkipLink';
import { normaliseLinkText } from '@/lib/internal-links';

/** The page component behind every static public route. */
export const STATIC_ROUTE_PAGES: Readonly<Record<string, () => React.ReactElement>> = {
  '/': HomePage,
  '/buy': BuyPage,
  '/sell': SellPage,
  '/rent': RentPage,
  '/rent-out': RentOutPage,
  '/commercial': CommercialPage,
  '/areas': AreasPage,
  '/guides': GuidesPage,
  '/how-it-works': HowItWorksPage,
  '/about': AboutPage,
  '/about/utpal-raj-kb': OwnerProfilePage,
  '/contact': ContactPage,
};

const props = (slug: string) => ({ params: Promise.resolve({ slug }) });

/** The markup a route's page renders inside `<main>`. */
export async function renderRouteContent(path: string): Promise<string> {
  const Page = STATIC_ROUTE_PAGES[path];
  if (Page) return renderToStaticMarkup(<Page />);

  const area = path.match(/^\/areas\/([^/]+)$/);
  if (area) return renderToStaticMarkup(await LocalityPage(props(area[1]!)));

  const guide = path.match(/^\/guides\/([^/]+)$/);
  if (guide) return renderToStaticMarkup(await GuidePage(props(guide[1]!)));

  throw new Error(`No page component is mapped for the public route ${path}.`);
}

export interface RenderedShell {
  /** The header as first served, drawer closed. */
  readonly header: string;
  /** The header with its drawer open, so the drawer's links are read too. */
  readonly drawer: string;
  readonly footer: string;
  readonly actionBar: string;
}

/** The layout shell every public route is served inside. */
export function renderShell(): RenderedShell {
  const noop = () => undefined;
  return {
    header: renderToStaticMarkup(<Header isMenuOpen={false} onMenuOpenChange={noop} />),
    drawer: renderToStaticMarkup(<Header isMenuOpen onMenuOpenChange={noop} />),
    footer: renderToStaticMarkup(<Footer />),
    actionBar: renderToStaticMarkup(<MobileActionBar />),
  };
}

export function parseMarkup(markup: string): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = markup;
  return container;
}

/**
 * The text a link is announced by: its `aria-label` when it has one, otherwise its
 * text with anything `aria-hidden` left out. Element boundaries count as a space,
 * so "<span>Call</span><span>9353096264</span>" reads "Call 9353096264".
 */
export function accessibleLinkText(anchor: Element): string {
  const label = anchor.getAttribute('aria-label');
  if (label && label.trim()) return normaliseLinkText(label);

  const textOf = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    if ((node as Element).getAttribute('aria-hidden') === 'true') return '';
    return Array.from(node.childNodes).map(textOf).join(' ');
  };
  return normaliseLinkText(textOf(anchor));
}

export interface RenderedLink {
  readonly href: string;
  readonly text: string;
}

/** Every `<a href>` in the markup, in document order. */
export function renderedLinks(markup: string): RenderedLink[] {
  return Array.from(parseMarkup(markup).querySelectorAll('a[href]')).map((anchor) => ({
    href: anchor.getAttribute('href') ?? '',
    text: accessibleLinkText(anchor),
  }));
}

// ---------------------------------------------------------------------------
// A page as served, and a route as requested — Requirements 8.3, 8.8 and 8.10
// ---------------------------------------------------------------------------

/**
 * The regions of one served response, in document order, as `src/app/layout.tsx`
 * and `LayoutShell` assemble them: the skip link, the header, `<main>`, the footer
 * and the mobile action bar.
 *
 * The header is the header as first served, drawer closed. The drawer's links are
 * rendered only after a reader opens it, so they are not in the server-rendered
 * HTML a crawler receives, and Requirement 8.8 counts that HTML. If the drawer is
 * ever rendered into the first response, it will appear in `header` here by itself.
 */
export const SERVED_REGIONS = ['skipLink', 'header', 'main', 'footer', 'actionBar'] as const;
export type ServedRegion = (typeof SERVED_REGIONS)[number];

export interface ServedPage {
  readonly route: string;
  readonly regions: Readonly<Record<ServedRegion, string>>;
}

/**
 * Every region of the HTML one route is served as. The caller's `usePathname` mock
 * must already return `route`, because the action bar's enquiry link follows it.
 */
export async function renderServedPage(route: string): Promise<ServedPage> {
  const main = await renderRouteContent(route);
  const shell = renderShell();
  return {
    route,
    regions: {
      skipLink: renderToStaticMarkup(<SkipLink targetId="main-content" />),
      header: shell.header,
      main,
      footer: shell.footer,
      actionBar: shell.actionBar,
    },
  };
}

/** The served page's hrefs, region by region. */
export function servedHrefsByRegion(page: ServedPage): Record<ServedRegion, string[]> {
  const out = {} as Record<ServedRegion, string[]>;
  for (const region of SERVED_REGIONS) {
    out[region] = renderedLinks(page.regions[region]).map((link) => link.href);
  }
  return out;
}

/** The served page's links, in document order. */
export function servedLinks(page: ServedPage): RenderedLink[] {
  return SERVED_REGIONS.flatMap((region) => renderedLinks(page.regions[region]));
}

/**
 * Every text an anchor can be read by, not only its accessible name: the name,
 * its full text including anything `aria-hidden`, its `aria-label`, its `title`
 * and the `alt` of any image inside it. A superlative hidden from a screen reader
 * is still anchor text to a crawler, so Requirement 8.3 reads all of them.
 */
export function renderedAnchorTexts(markup: string): string[] {
  // All of an element's text, hidden parts included, with element boundaries read
  // as a space — so "<span>Best broker</span><span>Home</span>" is two words apart.
  const fullText = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    return Array.from(node.childNodes).map(fullText).join(' ');
  };
  const texts: string[] = [];
  for (const anchor of Array.from(parseMarkup(markup).querySelectorAll('a[href]'))) {
    const variants = [
      accessibleLinkText(anchor),
      fullText(anchor),
      anchor.getAttribute('aria-label') ?? '',
      anchor.getAttribute('title') ?? '',
      ...Array.from(anchor.querySelectorAll('img[alt]')).map((image) => image.getAttribute('alt') ?? ''),
    ]
      .map(normaliseLinkText)
      .filter((text) => text.length > 0);
    texts.push(...new Set(variants));
  }
  return texts;
}

/**
 * How the App Router answers a request, read off what the page does rather than
 * assumed: a page that renders is a 200; `notFound()` is the status its digest
 * carries; `redirect` and `permanentRedirect` are the status their digest carries,
 * with the location; a path no page is mapped for is a 404; anything else thrown
 * is a 500.
 */
export interface RouteResponse {
  readonly status: number;
  readonly detail: string | null;
}

function digestOf(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    return String((error as { digest?: unknown }).digest ?? '');
  }
  throw new Error('Expected the navigation helper to throw.');
}

/** The digest prefixes Next uses, taken from the real functions. */
const HTTP_FALLBACK_PREFIX = digestOf(() => notFound()).split(';')[0]!;
const REDIRECT_PREFIX = digestOf(() => permanentRedirect('/')).split(';')[0]!;

/** The status a thrown navigation error stands for, or null if it is not one. */
export function statusFromThrown(error: unknown): RouteResponse | null {
  const digest = String((error as { digest?: unknown } | null)?.digest ?? '');
  const parts = digest.split(';');
  if (parts[0] === HTTP_FALLBACK_PREFIX && HTTP_FALLBACK_PREFIX.length > 0) {
    return { status: Number(parts[1]), detail: 'the page called notFound()' };
  }
  if (parts[0] === REDIRECT_PREFIX && REDIRECT_PREFIX.length > 0) {
    return { status: Number(parts[3]), detail: `redirects to ${parts[2]}` };
  }
  return null;
}

/**
 * Request one site path — no query, no fragment — the way the build would: resolve
 * it to its page, render the page, and report what the router would answer.
 */
export async function requestRoute(path: string): Promise<RouteResponse> {
  // `next.config.ts` leaves `trailingSlash` at its default, false, so the router
  // answers any other path ending in a slash with a redirect to the path without it.
  if (path.length > 1 && path.endsWith('/')) {
    return { status: 308, detail: `redirects to ${path.replace(/\/+$/, '') || '/'} (trailing slash)` };
  }
  const mapped =
    Object.hasOwn(STATIC_ROUTE_PAGES, path) || /^\/areas\/[^/]+$/.test(path) || /^\/guides\/[^/]+$/.test(path);
  if (!mapped) return { status: 404, detail: 'no page is registered for this path' };
  try {
    await renderRouteContent(path);
    return { status: 200, detail: null };
  } catch (error) {
    return (
      statusFromThrown(error) ?? {
        status: 500,
        detail: `the page threw: ${error instanceof Error ? error.message : String(error)}`,
      }
    );
  }
}

/**
 * `requestRoute`, answered once per path. One requester belongs to one world — one
 * registry, one clock — so make a new one whenever either changes.
 */
export function createRouteRequester(): (path: string) => Promise<RouteResponse> {
  const answers = new Map<string, Promise<RouteResponse>>();
  return (path) => {
    let answer = answers.get(path);
    if (!answer) {
      answer = requestRoute(path);
      answers.set(path, answer);
    }
    return answer;
  };
}
