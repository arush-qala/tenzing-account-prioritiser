import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: allActions } = await supabase
    .from('actions')
    .select('ai_accuracy_rating');

  const counts = { spot_on: 0, mostly_right: 0, partially_right: 0, wrong: 0 };
  let total = 0;

  if (allActions) {
    for (const action of allActions) {
      const rating = action.ai_accuracy_rating as string | null;
      if (rating && rating in counts) {
        counts[rating as keyof typeof counts]++;
        total++;
      }
    }
  }

  const accurate = counts.spot_on + counts.mostly_right;
  const percentage = total > 0 ? Math.round((accurate / total) * 100) : 0;

  return NextResponse.json({ counts, total, accurate, percentage });
}
