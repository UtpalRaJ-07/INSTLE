/**
 * Genuine review records.
 *
 * Master prompt section 23:
 *   "Start with no score and no review count unless real evidence exists."
 *   "If there are one, three, or ten approved reviews, display the actual
 *    evidence without a fabricated larger count."
 *
 * APPROVED_REVIEWS is empty because no real customer review has been supplied.
 * The homepage review section is therefore omitted entirely — not replaced with
 * empty stars, a placeholder name, or a "0 reviews" widget.
 *
 * There are deliberately no synthetic review fixtures in this file. Development
 * fixtures live in the test suite only, so they cannot reach a build, a static
 * export, structured data, or a publication queue.
 */

export interface ReviewRecord {
  reviewId: string;
  /** Where the review was left, e.g. "Google Business Profile". */
  source: string;
  /** Identifier or URL of the original review. */
  sourceReference: string | null;
  /** ISO date the customer actually left the review. */
  reviewDate: string;
  /** Explicit permission from the customer to republish on this website. */
  permissionToRepublish: boolean;
  /** How the customer agreed to be credited, e.g. "First name only". */
  allowedAttribution: string;
  /** The customer's own words, unedited. */
  originalText: string;
  /** Star value only if the source platform recorded one. Never inferred. */
  sourceRating: number | null;
  approvalState: 'pending' | 'approved' | 'withdrawn' | 'corrected';
  /** Person who verified the review and the permission. */
  verifiedBy: string | null;
}

export const APPROVED_REVIEWS: readonly ReviewRecord[] = [] as const;

export interface ReviewDisplayState {
  /** Whether any review UI should render at all. */
  hasApprovedReviews: boolean;
  /** Actual count of approved, permissioned reviews. Never rounded up. */
  count: number;
  /**
   * Average of source ratings, only when every displayed review carries one.
   * Null otherwise — a partial set must not produce an implied score.
   */
  averageSourceRating: number | null;
  reviews: readonly ReviewRecord[];
}

export function getReviewDisplayState(): ReviewDisplayState {
  const publishable = APPROVED_REVIEWS.filter(
    (review) => review.approvalState === 'approved' && review.permissionToRepublish
  );

  const allRated = publishable.length > 0 && publishable.every((r) => typeof r.sourceRating === 'number');
  const averageSourceRating = allRated
    ? publishable.reduce((sum, r) => sum + (r.sourceRating ?? 0), 0) / publishable.length
    : null;

  return {
    hasApprovedReviews: publishable.length > 0,
    count: publishable.length,
    averageSourceRating,
    reviews: publishable,
  };
}

/**
 * Structured data policy for reviews.
 *
 * Always false. Master prompt section 20: "Do not add a self-serving
 * AggregateRating/Review markup scheme to seek stars for this brokerage."
 */
export const AGGREGATE_RATING_MARKUP_PERMITTED = false;
