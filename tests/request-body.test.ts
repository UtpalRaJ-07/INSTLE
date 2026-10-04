import { describe, expect, it } from 'vitest';
import {
  MAX_ENQUIRY_BODY_BYTES,
  deriveClientIdentifier,
  readJsonBodyWithLimit,
} from '@/lib/request-body';

/**
 * The original body cap read `content-length` and trusted it. These tests prove the
 * limit now applies to bytes actually read, including when the header lies or is
 * absent entirely.
 */

function streamRequest(body: string, headers: Record<string, string> = {}): Request {
  const encoded = new TextEncoder().encode(body);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Deliver in small chunks so the running total is what triggers the limit.
      const chunkSize = 1024;
      for (let offset = 0; offset < encoded.byteLength; offset += chunkSize) {
        controller.enqueue(encoded.slice(offset, offset + chunkSize));
      }
      controller.close();
    },
  });

  return new Request('https://example.test/api/enquiry', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: stream,
    // Required by undici when a stream body is used.
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });
}

describe('readJsonBodyWithLimit', () => {
  it('parses a valid JSON body', async () => {
    const result = await readJsonBodyWithLimit(streamRequest(JSON.stringify({ a: 1 })));
    expect(result).toEqual({ ok: true, value: { a: 1 } });
  });

  it('rejects a non-JSON content type', async () => {
    const request = new Request('https://example.test/api/enquiry', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: '{}',
    });
    expect(await readJsonBodyWithLimit(request)).toEqual({
      ok: false,
      reason: 'unsupported-media-type',
    });
  });

  it('accepts a JSON content type carrying a charset parameter', async () => {
    const request = streamRequest(JSON.stringify({ a: 1 }), {
      'content-type': 'application/json; charset=utf-8',
    });
    expect((await readJsonBodyWithLimit(request)).ok).toBe(true);
  });

  it('rejects a body over the limit when content-length is declared', async () => {
    const oversized = JSON.stringify({ note: 'x'.repeat(MAX_ENQUIRY_BODY_BYTES + 100) });
    const request = new Request('https://example.test/api/enquiry', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': String(new TextEncoder().encode(oversized).byteLength),
      },
      body: oversized,
    });
    expect(await readJsonBodyWithLimit(request)).toEqual({ ok: false, reason: 'too-large' });
  });

  // The important case: the header is absent, so only counting real bytes works.
  it('rejects a body over the limit with no content-length header at all', async () => {
    const oversized = JSON.stringify({ note: 'x'.repeat(MAX_ENQUIRY_BODY_BYTES + 100) });
    const request = streamRequest(oversized);
    expect(request.headers.get('content-length')).toBeNull();
    expect(await readJsonBodyWithLimit(request)).toEqual({ ok: false, reason: 'too-large' });
  });

  it('rejects a body over the limit when content-length understates the size', async () => {
    const oversized = JSON.stringify({ note: 'x'.repeat(MAX_ENQUIRY_BODY_BYTES + 100) });
    const request = streamRequest(oversized, { 'content-length': '10' });
    expect(await readJsonBodyWithLimit(request)).toEqual({ ok: false, reason: 'too-large' });
  });

  it('accepts a body just under the limit', async () => {
    const padding = 'y'.repeat(MAX_ENQUIRY_BODY_BYTES - 200);
    const request = streamRequest(JSON.stringify({ note: padding }));
    expect((await readJsonBodyWithLimit(request)).ok).toBe(true);
  });

  it('reports malformed JSON', async () => {
    expect(await readJsonBodyWithLimit(streamRequest('{ not json'))).toEqual({
      ok: false,
      reason: 'malformed',
    });
  });

  it('reports an empty body', async () => {
    expect(await readJsonBodyWithLimit(streamRequest('   '))).toEqual({
      ok: false,
      reason: 'empty',
    });
  });
});

describe('deriveClientIdentifier', () => {
  function requestWithForwardedFor(value: string): Request {
    return new Request('https://example.test/api/enquiry', {
      method: 'POST',
      headers: { 'x-forwarded-for': value },
    });
  }

  it('ignores x-forwarded-for when no trusted proxy hop count is declared', () => {
    const result = deriveClientIdentifier(requestWithForwardedFor('1.2.3.4'));
    expect(result.identifier).toBe('untrusted-shared-bucket');
    expect(result.trusted).toBe(false);
  });

  // A client that can prepend entries would otherwise get a fresh rate-limit
  // bucket on every request.
  it('is not fooled by a spoofed chain when hops are undeclared', () => {
    const spoofed = deriveClientIdentifier(
      requestWithForwardedFor('9.9.9.9, 8.8.8.8, 7.7.7.7')
    );
    expect(spoofed.identifier).toBe('untrusted-shared-bucket');
  });

  it('reads the client address from the declared hop position', () => {
    process.env.INSTLE_TRUSTED_PROXY_HOPS = '1';
    const result = deriveClientIdentifier(requestWithForwardedFor('9.9.9.9, 203.0.113.7'));
    expect(result).toEqual({ identifier: '203.0.113.7', trusted: true });
  });

  it('falls back to the shared bucket when the chain is shorter than the declared hops', () => {
    process.env.INSTLE_TRUSTED_PROXY_HOPS = '3';
    const result = deriveClientIdentifier(requestWithForwardedFor('203.0.113.7'));
    expect(result.identifier).toBe('untrusted-shared-bucket');
  });
});
