// ---------------------------------------------------------------------------
// GET & POST /api/actions — Manage account actions
// ---------------------------------------------------------------------------
// GET: Fetch actions for a specific account (query param: account_id)
// POST: Record a new action against an account
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const VALID_ACTION_TYPES = [
  'call_scheduled',
  'escalation',
  'expansion_meeting',
  'qbr_booked',
  'note_added',
  'other',
] as const;

const VALID_ACCURACY_RATINGS = [
  'wrong',
  'partially_right',
  'mostly_right',
  'spot_on',
] as const;

type ActionType = (typeof VALID_ACTION_TYPES)[number];
type AccuracyRating = (typeof VALID_ACCURACY_RATINGS)[number];

// ---------------------------------------------------------------------------
// GET /api/actions?account_id=ACC-001
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  try {
    const supabase = createServerSupabaseClient();

    // ---- Auth ----
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ---- Parse query params ----
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('account_id');
    if (!accountId) {
      return NextResponse.json(
        { error: 'Missing account_id query parameter' },
        { status: 400 },
      );
    }

    // ---- Fetch actions ----
    const { data: actions, error: fetchError } = await supabase
      .from('actions')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      return NextResponse.json(
        { error: 'Failed to fetch actions', details: fetchError.message },
        { status: 500 },
      );
    }

    return NextResponse.json(actions ?? []);
  } catch (error) {
    console.error('[API GET /actions] Unhandled error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/actions
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient();

    // ---- Auth ----
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ---- Parse body ----
    const body = await request.json();
    const { account_id, action_type, description, ai_accuracy_rating } =
      body as {
        account_id?: string;
        action_type?: string;
        description?: string;
        ai_accuracy_rating?: string;
      };

    // ---- Validate required fields ----
    if (!account_id) {
      return NextResponse.json(
        { error: 'Missing account_id' },
        { status: 400 },
      );
    }
    if (!action_type) {
      return NextResponse.json(
        { error: 'Missing action_type' },
        { status: 400 },
      );
    }
    if (!description) {
      return NextResponse.json(
        { error: 'Missing description' },
        { status: 400 },
      );
    }

    // ---- Validate action_type ----
    if (
      !VALID_ACTION_TYPES.includes(action_type as ActionType)
    ) {
      return NextResponse.json(
        {
          error: `Invalid action_type. Must be one of: ${VALID_ACTION_TYPES.join(', ')}`,
        },
        { status: 400 },
      );
    }

    // ---- Validate ai_accuracy_rating (optional) ----
    if (
      ai_accuracy_rating !== undefined &&
      ai_accuracy_rating !== null &&
      !VALID_ACCURACY_RATINGS.includes(ai_accuracy_rating as AccuracyRating)
    ) {
      return NextResponse.json(
        {
          error: `Invalid ai_accuracy_rating. Must be one of: ${VALID_ACCURACY_RATINGS.join(', ')}`,
        },
        { status: 400 },
      );
    }

    // ---- Insert action ----
    const { data: action, error: insertError } = await supabase
      .from('actions')
      .insert({
        account_id,
        action_type,
        description,
        ai_accuracy_rating: ai_accuracy_rating ?? null,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to create action', details: insertError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ action }, { status: 201 });
  } catch (error) {
    console.error('[API POST /actions] Unhandled error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
