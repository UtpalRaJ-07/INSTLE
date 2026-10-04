import { notFound } from 'next/navigation';
import { getDeployEnvironment } from '@/config/site';

/**
 * Keeps private design prototypes out of a production deployment.
 *
 * Master prompt section 18: "Prototype routes must remain noindex and outside
 * navigation/sitemaps; remove from production or protect them if possible."
 *
 * The prototype pages already carry `noindex`. This adds the stronger guarantee:
 * in a production deployment they return a genuine 404, so the unapproved copy
 * inside them is not publicly reachable at all. They stay available in
 * development and preview builds, which is where design review happens.
 */
export function assertPrototypeAccessAllowed(): void {
  if (getDeployEnvironment() === 'production') {
    notFound();
  }
}
