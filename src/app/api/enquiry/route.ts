import { NextResponse } from 'next/server';
import { PRIMARY_PHONE } from '@/config/constants';
import { getDeployEnvironment, isRealIntakeEnabled } from '@/config/site';
import { validateLeadPayload } from '@/lib/enquiry-schema';
import { processLeadEnquiry } from '@/lib/lead-operations';
import { getIdempotencyStore } from '@/lib/idempotency';
import { checkRateLimit, getRateLimitStore } from '@/lib/rate-limit';
import { deriveClientIdentifier, readJsonBodyWithLimit } from '@/lib/request-body';
import { trackSafeEvent } from '@/lib/telemetry';

/**
 * Enquiry intake.
 *
 * Responses are always `no-store`: the body contains the customer's own
 * reference number, which must not be cached by an intermediary or indexed.
 *
 * The route returns customer success only after `processLeadEnquiry` confirms a
 * durable destination accepted the record. Every other outcome returns a failure
 * with the phone number as the alternative path.
 */

const CALL_FALLBACK = `Please call ${PRIMARY_PHONE} and we will take your requirement over the phone.`;

/**
 * Requirement 6.7. Carried by every response this route writes, success and
 * failure alike, so a personal response is neither cached nor indexed.
 */
const PRIVATE_RESPONSE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'X-Robots-Tag': 'noindex, nofollow',
} as const;

/** The only methods this route serves. Sent on 405 and OPTIONS responses. */
const ALLOWED_METHODS = 'OPTIONS, POST';

function jsonResponse(body: Record<string, unknown>, status: number): NextResponse {
  return NextResponse.json(body, { status, headers: PRIVATE_RESPONSE_HEADERS });
}

function unexpectedErrorResponse(): NextResponse {
  // Nothing about the error is logged, because an error message can contain
  // submitted values.
  trackSafeEvent('form_submit_error', { sourceComponent: 'enquiry-api', statusCode: 500 });
  return jsonResponse(
    {
      success: false,
      code: 'unexpected-error',
      error: `Something went wrong on our side. ${CALL_FALLBACK}`,
      phone: PRIMARY_PHONE,
    },
    500
  );
}

function methodNotAllowed(): NextResponse {
  const response = jsonResponse({ success: false, error: 'Method not allowed.' }, 405);
  response.headers.set('Allow', ALLOWED_METHODS);
  return response;
}

export async function POST(request: Request) {
  // A throw anywhere in the handler (a rate-limit or idempotency store that
  // cannot be reached, say) would otherwise leave the framework to write a bare
  // 500 without the headers above.
  try {
    return await handleEnquiry(request);
  } catch {
    return unexpectedErrorResponse();
  }
}

async function handleEnquiry(request: Request): Promise<NextResponse> {
  const environment = getDeployEnvironment();

  // 1. Call-only mode. Until the owner supplies an approved destination, notice
  //    text and retention process, the form does not accept real personal data.
  if (!isRealIntakeEnabled()) {
    return jsonResponse(
      {
        success: false,
        code: 'intake-disabled',
        error: `Online enquiries are not switched on yet. ${CALL_FALLBACK}`,
        phone: PRIMARY_PHONE,
      },
      503
    );
  }

  // 2. Refuse production traffic while abuse controls cannot actually work
  //    across instances, rather than appearing to enforce limits that do not hold.
  if (environment === 'production') {
    if (!getRateLimitStore().isDistributed || !getIdempotencyStore().isDistributed) {
      return jsonResponse(
        {
          success: false,
          code: 'abuse-controls-unavailable',
          error: `We cannot accept online enquiries at the moment. ${CALL_FALLBACK}`,
          phone: PRIMARY_PHONE,
        },
        503
      );
    }
  }

  // 3. Rate limiting, using connection information the deployment has declared
  //    trustworthy. A forwarded header is not trusted by default.
  const client = deriveClientIdentifier(request);
  const rateLimit = await checkRateLimit(client.identifier);
  if (!rateLimit.allowed) {
    trackSafeEvent('form_submit_error', { sourceComponent: 'enquiry-api', statusCode: 429 });
    return jsonResponse(
      {
        success: false,
        code: 'rate-limited',
        error: `That is a few attempts in a short time. Please wait a little, or call ${PRIMARY_PHONE}.`,
        phone: PRIMARY_PHONE,
      },
      429
    );
  }

  // 4. Read the body with a real byte ceiling, not a trusted Content-Length.
  const bodyResult = await readJsonBodyWithLimit(request);
  if (!bodyResult.ok) {
    const status =
      bodyResult.reason === 'too-large' ? 413 : bodyResult.reason === 'unsupported-media-type' ? 415 : 400;
    trackSafeEvent('form_submit_error', { sourceComponent: 'enquiry-api', statusCode: status });
    const message =
      bodyResult.reason === 'too-large'
        ? 'That enquiry is too large to accept.'
        : bodyResult.reason === 'unsupported-media-type'
          ? 'Unsupported content type.'
          : 'We could not read that enquiry.';
    return jsonResponse(
      { success: false, code: bodyResult.reason, error: `${message} ${CALL_FALLBACK}`, phone: PRIMARY_PHONE },
      status
    );
  }

  // 5. Strict server-side validation.
  const validation = validateLeadPayload(bodyResult.value);
  if (!validation.valid || !validation.sanitizedPayload) {
    trackSafeEvent('form_submit_error', { sourceComponent: 'enquiry-api', statusCode: 422 });
    return jsonResponse(
      {
        success: false,
        code: 'validation-failed',
        error: 'Please check the highlighted details.',
        // Field names and messages only. The submitted values are never echoed.
        errors: validation.errors,
      },
      422
    );
  }

  const payload = validation.sanitizedPayload;

  // 6. Process. No try/catch around a "return success" path: the result object
  //    is the only thing that decides what the customer is told.
  let result;
  try {
    result = await processLeadEnquiry(payload);
  } catch {
    // An unexpected throw is a failure, never a success.
    return unexpectedErrorResponse();
  }

  if (!result.success) {
    const status = result.failureCode === 'idempotency-conflict' ? 409 : result.retriable ? 503 : 422;
    const message =
      result.failureCode === 'duplicate-in-flight'
        ? 'We are already processing that enquiry. Please wait a moment before trying again.'
        : result.failureCode === 'idempotency-conflict'
          ? 'That submission could not be matched to your details. Please start a fresh enquiry.'
          : `We could not save your enquiry just now, so please do not assume we have it. ${CALL_FALLBACK}`;

    return jsonResponse(
      {
        success: false,
        code: result.failureCode,
        error: message,
        retriable: result.retriable,
        phone: PRIMARY_PHONE,
      },
      status
    );
  }

  // 7. Success. A reference and next steps only — never the stored record.
  return jsonResponse(
    {
      success: true,
      reference: result.leadId,
      isDuplicate: result.isDuplicate,
      message: result.isDuplicate
        ? 'We already have this enquiry. Your reference is unchanged.'
        : 'We have your enquiry.',
      nextSteps: `Someone from our team will call you on the number you gave us. If you would rather speak now, call ${PRIMARY_PHONE}.`,
      phone: PRIMARY_PHONE,
    },
    200
  );
}

/**
 * Reject every other method explicitly. Public clients cannot read enquiries.
 *
 * Each method is declared rather than left to the framework, whose automatic 405
 * and OPTIONS responses carry neither `no-store` nor `noindex` (Requirement 6.7).
 * HEAD is derived from GET by the framework, so it inherits these headers.
 */
export async function GET() {
  return methodNotAllowed();
}

export async function PUT() {
  return methodNotAllowed();
}

export async function PATCH() {
  return methodNotAllowed();
}

export async function DELETE() {
  return methodNotAllowed();
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { ...PRIVATE_RESPONSE_HEADERS, Allow: ALLOWED_METHODS },
  });
}
