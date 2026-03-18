import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;

  if (!apiKey || !agentId) {
    return NextResponse.json(
      { error: 'ElevenLabs not configured' },
      { status: 500 },
    );
  }

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
      {
        method: 'GET',
        headers: { 'xi-api-key': apiKey },
      },
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Unknown error');
      return NextResponse.json(
        { error: `ElevenLabs error: ${errText}` },
        { status: res.status },
      );
    }

    const body = await res.json();
    return NextResponse.json({ signed_url: body.signed_url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get voice token';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
