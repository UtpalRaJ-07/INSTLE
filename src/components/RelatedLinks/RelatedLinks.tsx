import React from 'react';
import { LinkCard, LinkCardGrid, Section, SectionHeader } from '@/components/ui';
import { renderableLinkGroups, type LinkGroup } from '@/lib/internal-links';

/**
 * The Internal_Link_System's groups, rendered one way on every content page.
 * Requirements 8.1, 8.9 and 8.11.
 *
 * Server-rendered, so every link is in the initial HTML. A group with no links is
 * not rendered at all — no heading, no section, no empty list — and when every
 * group is empty the component renders nothing. Each link sits in its own list
 * item with its context beside it, which for a nearby locality is the
 * claim-backed relationship statement.
 *
 * The groups arrive already decided by `src/lib/internal-links.ts`: gate-passing
 * destinations only, six at most, link text checked. This component adds markup
 * and nothing else, so no page can render a group the module did not build.
 *
 * Each heading's id is `${idPrefix}-${group.key}-heading`, which keeps the id the
 * locality page's nearby section has always had (`locality-nearby-heading`).
 */
export function RelatedLinks({
  groups,
  idPrefix,
  tone = 'raised',
}: {
  groups: readonly LinkGroup[];
  idPrefix: string;
  tone?: 'paper' | 'raised';
}) {
  const visible = renderableLinkGroups(groups);
  if (visible.length === 0) return null;

  return (
    <>
      {visible.map((group) => {
        const headingId = `${idPrefix}-${group.key}-heading`;
        return (
          <Section key={group.key} tone={tone} labelledBy={headingId}>
            <SectionHeader titleId={headingId} eyebrow={group.eyebrow} title={group.title} />
            <LinkCardGrid group={group.key}>
              {group.links.map((link) => (
                <LinkCard key={link.href} href={link.href} title={link.text}>
                  {link.description}
                </LinkCard>
              ))}
            </LinkCardGrid>
          </Section>
        );
      })}
    </>
  );
}
