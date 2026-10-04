/**
 * Byte-bounded request body reading.
 *
 * The previous implementation read `content-length` and trusted it. A client can
 * omit or understate that header, or use chunked transfer encoding, so the cap was
 * advisory only. This reader counts the bytes it actually pulls off the stream and
 * stops as soon as the limit is exceeded.
 */

export const MAX_ENQUIRY_BODY_BYTES = 16 * 1024;

export type ReadBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: 'unsupported-media-type' | 'too-large' | 'malformed' | 'empty' };

function isJsonContentType(header: string | null): boolean {
  if (!header) return false;
  // Ignore parameters such as "; charset=utf-8".
  const mediaType = header.split(';')[0]!.trim().toLowerCase();
  return mediaType === 'application/json';
}

/**
 * Read and parse a JSON request body, refusing anything over `maxBytes`.
 *
 * @param request the incoming request
 * @param maxBytes hard byte ceiling applied to the actual stream
 */
export async function readJsonBodyWithLimit(
  request: Request,
  maxBytes: number = MAX_ENQUIRY_BODY_BYTES
): Promise<ReadBodyResult> {
  if (!isJsonContentType(request.headers.get('content-type'))) {
    return { ok: false, reason: 'unsupported-media-type' };
  }

  // A declared length over the limit is rejected early as a cheap optimisation.
  // It is never treated as proof that a smaller body is within the limit.
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { ok: false, reason: 'too-large' };
  }

  const body = request.body;
  let text: string;

  if (!body) {
    // No stream available (some runtimes and most test doubles). Fall back to
    // text() and measure the real encoded byte length.
    let raw: string;
    try {
      raw = await request.text();
    } catch {
      return { ok: false, reason: 'malformed' };
    }
    if (new TextEncoder().encode(raw).byteLength > maxBytes) {
      return { ok: false, reason: 'too-large' };
    }
    text = raw;
  } else {
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        received += value.byteLength;
        if (received > maxBytes) {
          await reader.cancel().catch(() => undefined);
          return { ok: false, reason: 'too-large' };
        }
        chunks.push(value);
      }
    } catch {
      return { ok: false, reason: 'malformed' };
    }

    const merged = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    text = new TextDecoder('utf-8', { fatal: false }).decode(merged);
  }

  if (text.trim().length === 0) {
    return { ok: false, reason: 'empty' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  return { ok: true, value: parsed };
}

/**
 * Derive a client identifier for abuse controls.
 *
 * `x-forwarded-for` is only trusted when the deployment explicitly declares how
 * many proxy hops sit in front of the app, via INSTLE_TRUSTED_PROXY_HOPS. Without
 * that declaration an arbitrary client could prepend any address it likes and
 * defeat rate limiting entirely, so the header is ignored.
 */
export function deriveClientIdentifier(request: Request): {
  identifier: string;
  trusted: boolean;
} {
  const declaredHops = Number(process.env.INSTLE_TRUSTED_PROXY_HOPS);
  const hops = Number.isInteger(declaredHops) && declaredHops > 0 ? declaredHops : 0;

  if (hops > 0) {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
      // With N trusted hops, the client address is the Nth entry from the right.
      const entries = forwarded
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
      const index = entries.length - hops;
      const candidate = entries[index];
      if (candidate) {
        return { identifier: candidate, trusted: true };
      }
    }
  }

  // No trusted connection information available. Return a constant bucket so the
  // limiter still applies globally, and flag it as untrusted so the caller can
  // refuse production traffic rather than pretend per-client limiting works.
  return { identifier: 'untrusted-shared-bucket', trusted: hops > 0 };
}
