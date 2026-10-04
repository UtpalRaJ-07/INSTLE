import { readFileSync, readdirSync, statSync } from 'node:fs';

import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

import { CRAWLER_DECISION_CHECKLIST_ENTRIES } from '@/config/crawler-access';
import { HEADING_INTENT_PROVENANCE_GAP } from '@/config/guides';
import { KEYWORD_RESEARCH_TOOL_LICENCE } from '@internal/registers/search-intent';

/**
 * The owner input register, checked as the single place an owner request is worded.
 *
 * Requirements 3.7 and 6.4 each direct a new section C entry to be recorded, and
 * Requirement 13.4 has the progress report reference an entry by its identifier
 * rather than restate the request. Two things are therefore worth asserting: that
 * every identifier the code cites resolves to a real row, and that the request
 * wording lives in the register and nowhere else. Code may name `C13`; it may not
 * carry the sentence asking for a keyword research tool.
 *
 * The entries themselves are requests for information, not records of one. No test
 * here asserts an answer, a deciding name or a date, because none has been supplied.
 */

const ROOT = join(__dirname, '..');
const CHECKLIST_PATH = join(ROOT, 'docs', 'implementation', 'OWNER-FACTS-CHECKLIST.md');
const checklist = readFileSync(CHECKLIST_PATH, 'utf8');

/** Section C, from its heading to the next top-level section. */
function sectionC(): string {
  const start = checklist.indexOf('## C. Needed before specific content can publish');
  expect(start).toBeGreaterThan(-1);
  const end = checklist.indexOf('\n## ', start + 1);
  return checklist.slice(start, end === -1 ? undefined : end);
}

/** Each section C row, by identifier. */
function sectionCEntries(): Map<string, string> {
  const entries = new Map<string, string>();
  for (const line of sectionC().split('\n')) {
    const match = /^\|\s*(C\d+)\s*\|(.*)\|\s*$/.exec(line.trim());
    if (match) entries.set(match[1], match[2]);
  }
  return entries;
}

const entries = sectionCEntries();

describe('the three added section C entries', () => {
  it('asks for the keyword research tool as C13, after the existing C12', () => {
    const c13 = entries.get('C13');
    expect(c13).toBeDefined();
    expect(entries.has('C12')).toBe(true);
    expect(sectionC().indexOf('| C13 ')).toBeGreaterThan(sectionC().indexOf('| C12 '));
    expect(c13).toMatch(/keyword research tool/i);
    // What stays blocked without it, and what does not.
    expect(c13).toMatch(/volume/i);
    expect(c13).toMatch(/manual method/i);
    expect(c13).toMatch(/HEADING_INTENT_PROVENANCE_GAP/);
  });

  it('asks for the GPTBot training-crawl decision as C14, with its name, date and guidance check', () => {
    const c14 = entries.get('C14');
    expect(c14).toBeDefined();
    expect(c14).toContain('GPTBot');
    expect(c14).toMatch(/deciding person/i);
    expect(c14).toMatch(/decision date/i);
    expect(c14).toMatch(/guidance/i);
    expect(c14).toMatch(/90 days/);
    expect(c14).toContain('Disallow: /');
  });

  it('asks for the OAI-SearchBot search-crawl decision as C15, marked as blocking a release', () => {
    const c15 = entries.get('C15');
    expect(c15).toBeDefined();
    expect(c15).toContain('OAI-SearchBot');
    expect(c15).toMatch(/blocking release/i);
    expect(c15).toMatch(/deciding person/i);
    expect(c15).toMatch(/decision date/i);
    expect(c15).toMatch(/90 days/);
    expect(c15).toContain('Disallow: /');
    // The two crawler decisions are separate, and each row says so.
    expect(c15).toContain('C14');
    expect(entries.get('C14')).toContain('C15');
  });

  it('records in section C and in section A that C15 alone blocks a release', () => {
    expect(sectionC()).toMatch(/Only C15 blocks a release/);
    const sectionA = checklist.slice(
      checklist.indexOf('## A. Blocking a public release'),
      checklist.indexOf('## B.')
    );
    expect(sectionA).toMatch(/C15 also blocks a release/);
  });

  it('carries a worksheet line for each of the three, and no answer to any of them', () => {
    const worksheet = checklist.slice(checklist.indexOf('## D. Worksheet'), checklist.indexOf('## E.'));
    const lines = [
      'Keyword research tool (or "none, work manually"):',
      'GPTBot training crawl (allow / disallow):',
      'OAI-SearchBot search crawl (allow / disallow):',
    ];
    for (const line of lines) {
      expect(worksheet).toContain(line);
      // A worksheet line is blank until somebody fills it in.
      expect(worksheet).toContain(`${line}\n`);
    }
  });
});

describe('every checklist identifier the code cites', () => {
  const cited = [
    ...Object.values(CRAWLER_DECISION_CHECKLIST_ENTRIES).filter((id): id is string => id !== null),
    KEYWORD_RESEARCH_TOOL_LICENCE.ownerInputEntry,
    HEADING_INTENT_PROVENANCE_GAP.ownerInputEntry,
  ];

  it('cites at least the three entries this register now carries', () => {
    expect(cited).toContain('C13');
    expect(cited).toContain('C14');
    expect(cited).toContain('C15');
  });

  it('resolves to a real section C row', () => {
    for (const id of cited) {
      expect(entries.has(id), `${id} is cited in code but has no section C row`).toBe(true);
    }
  });
});

describe('the register is the only place the request wording lives', () => {
  /** Sentences that ask the owner for something. Each appears once, in the register. */
  const REQUEST_WORDING = [
    'Which keyword research tool should be licensed',
    'may crawl the public site for model training',
    'be allowed to crawl the public site, so its pages can be found',
  ];

  function filesUnder(dir: string): string[] {
    const found: string[] = [];
    const walk = (current: string) => {
      for (const entry of readdirSync(current)) {
        if (entry === 'node_modules' || entry.startsWith('.')) continue;
        const full = join(current, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx|mjs|js|jsx|css|json)$/.test(entry)) found.push(full);
      }
    };
    walk(dir);
    return found;
  }

  const sources = ['src', 'internal', 'scripts'].flatMap((dir) => filesUnder(join(ROOT, dir)));

  it('finds no request sentence in any source, register or script file', () => {
    const offenders = sources.flatMap((file) => {
      const text = readFileSync(file, 'utf8');
      return REQUEST_WORDING.filter((wording) => text.includes(wording)).map(
        (wording) => `${relative(ROOT, file)}: ${wording}`
      );
    });
    expect(offenders).toEqual([]);
  });

  it('finds each request sentence in the register itself', () => {
    for (const wording of REQUEST_WORDING) {
      expect(checklist).toContain(wording);
    }
  });
});
