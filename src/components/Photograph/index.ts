/**
 * The photograph pathway: built, tested and switched off.
 *
 * Requirement 10 is an *optional* pathway for real Bengaluru photography. Nothing
 * here renders today, because the Media_Register holds no photograph — checklist
 * C12 — and `OWNER_PROFILE.portrait` is null — checklist C7. Both entries are named
 * in `docs/implementation/OWNER-FACTS-CHECKLIST.md` and recorded as constants in
 * `src/config/media-register.ts`, so the answer that switches each one on is named
 * in code rather than in a note somebody has to find.
 *
 * `Photograph.tsx` is the only file in `src/` that constructs an image element. The
 * asset policy scan in `tests/visual-identity.test.tsx` permits it there, under the
 * conditions recorded in that file, and refuses it everywhere else.
 */

export {
  Photograph,
  PhotographSet,
  PHOTOGRAPH_PATHWAY_BLOCKED_BY,
  type PhotographProps,
} from './Photograph';
export {
  OwnerPortrait,
  ownerPortraitPresentation,
  OWNER_PORTRAIT_BLOCKED_BY,
  type OwnerPortraitPresentation,
} from './OwnerPortrait';
