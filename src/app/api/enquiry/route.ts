import { NextResponse } from 'next/server';
import { processSyntheticEnquiry, LeadPayload } from '@/lib/lead-operations';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const payload: LeadPayload = {
      intent: body.intent || 'buy',
      assetType: body.assetType || 'Residential',
      localities: Array.isArray(body.localities) ? body.localities : [],
      budgetBand: body.budgetBand,
      timeline: body.timeline,
      name: body.name || '',
      phone: body.phone || '',
      consent: Boolean(body.consent),
      idempotencyKey: body.idempotencyKey,
    };

    const result = processSyntheticEnquiry(payload);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        leadId: result.leadId,
        isDuplicate: result.isDuplicate,
        message: 'Synthetic enquiry enqueued successfully.',
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: 'Malformed request payload.' },
      { status: 400 }
    );
  }
}
