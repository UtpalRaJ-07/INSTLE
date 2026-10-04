/**
 * The Bengaluru identity: five server components, no photography, no external
 * request, no animation.
 *
 * Each one returns inline `<svg>` built from hand-written `path`, `rect` and
 * `circle` primitives, coloured with `currentColor` and the custom properties in
 * `src/styles/tokens.css`. Provenance for every asset lives in the Media_Register
 * at `src/config/media-register.ts`, and each component reads its own entry while
 * rendering — so an entry with incomplete provenance fails the build rather than
 * shipping a drawing nobody can account for.
 */

export { CivicStreetscapeBand, type StreetscapeVariant } from './CivicStreetscapeBand';
export { CorridorDiagram } from './CorridorDiagram';
export { LayoutGridMotif } from './LayoutGridMotif';
export {
  AreaOrientationPlate,
  PLATE_LABEL_STYLE,
  PLATE_VIEWBOX_HEIGHT,
  PLATE_VIEWBOX_WIDTH,
  neighbourDisplayName,
  plateLabelLayout,
  type NamedNearbyRelationship,
  type PlateLabelLayout,
  type PlateLabelRole,
} from './AreaOrientationPlate';
export { TypographicPlate } from './TypographicPlate';
export { AssetFigure, drawingProps, visibleAssetLabel } from './AssetFrame';
