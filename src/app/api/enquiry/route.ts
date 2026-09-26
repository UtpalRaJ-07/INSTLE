import { NextResponse } from 'next/server';
import {
  validateLeadPayload,
  checkRateLimit,
  processLeadEnquiry,
} from '@/lib/lead-operations';
import { trackSafeEvent } from '@/lib/telemetry';

export async function POST(request: Request) {
  // 1. Enforce payload size ceiling (32 KB max)
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 32 * 1024) {
    return NextResponse.json(
      { success: false, error: 'Payload exceeds maximum permitted size of 32 KB.' },
      { status: 413 }
    );
  }

  // 2. Client Identifier & Sliding-Window Rate Limiting
  const forwardedFor = request.headers.get('x-forwarded-for');
  const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';
  const rateLimitResult = checkRateLimit(clientIp);

  if (!rateLimitResult.allowed) {
    trackSafeEvent('form_submit_error', { statusCode: 429 });
    return NextResponse.json(
      {
        success: false,
        error: 'Too many enquiry attempts. Please wait several minutes or call our desk directly at 9353096264.',
      },
      { status: 429 }
    );
  }

  // 3. Parse JSON Body Safely
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    trackSafeEvent('form_submit_error', { statusCode: 400 });
    return NextResponse.json(
      { success: false, error: 'Malformed JSON payload.' },
      { status: 400 }
    );
  }

  // 4. Runtime Schema Validation
  const validation = validateLeadPayload(body);
  if (!validation.valid || !validation.sanitizedPayload) {
    trackSafeEvent('form_submit_error', { statusCode: 400 });
    return NextResponse.json(
      {
        success: false,
        error: 'Validation failed.',
        errors: validation.errors,
      },
      { status: 400 }
    );
  }

  // 5. Process Enquiry & Enqueue into Staging Store
  try {
    const result = await processLeadEnquiry(validation.sanitizedPayload);

    return NextResponse.json(
      {
        success: true,
        leadId: result.leadId,
        isDuplicate: result.isDuplicate,
        message: result.isDuplicate
          ? 'An identical enquiry was recently registered. Your reference remains active.'
          : 'Your advisory requirement has been registered in the intake queue.',
        nextSteps:
          'Our brokerage team reviews enquiries directly. For immediate discussion, telephone the desk at 9353096264.',
      },
      { status: 200 }
    );
  } catch {
    trackSafeEvent('form_submit_error', { statusCode: 500 });
    return NextResponse.json(
      {
        success: false,
        error: 'Unable to process enquiry at this time. Please contact our desk directly at 9353096264.',
      },
      { status: 500 }
    );
  }
}
