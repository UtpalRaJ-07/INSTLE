import React from 'react';
import { serialiseJsonLd, type JsonLdObject } from '@/lib/structured-data';

/**
 * Renders a JSON-LD block.
 *
 * The serialiser escapes `<`, `>`, `&` and the Unicode line separators, so a
 * value can never break out of the script element.
 */
export function JsonLd({ data }: { data: JsonLdObject }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serialiseJsonLd(data) }}
    />
  );
}
