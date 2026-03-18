import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const accountId = searchParams.get('account_id')
  const status = searchParams.get('status')
  const assignedTo = searchParams.get('assigned_to')

  let query = supabase
    .from('user_tasks')
    .select('*, accounts!inner(account_name)')
    .order('created_at', { ascending: false })

  if (accountId) {
    query = query.eq('account_id', accountId)
  }
  if (status && status !== 'all') {
    query = query.eq('status', status)
  }
  if (assignedTo) {
    query = query.eq('assigned_to', assignedTo)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { account_id, title, description, source, source_rationale, owner_suggestion, timeframe } = body

  if (!account_id || !title) {
    return NextResponse.json(
      { error: 'account_id and title are required' },
      { status: 400 },
    )
  }

  const { data, error } = await supabase
    .from('user_tasks')
    .insert({
      account_id,
      assigned_to: user.id,
      title,
      description: description || null,
      source: source || 'ai_recommendation',
      source_rationale: source_rationale || null,
      owner_suggestion: owner_suggestion || null,
      timeframe: timeframe || null,
      status: 'open',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
