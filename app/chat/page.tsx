'use client';

import { useEffect, useState } from 'react';
import { NavHeader } from '@/components/nav-header';
import { createClient } from '@/lib/supabase/client';
import { C1Chat, ArtifactViewMode } from '@thesysai/genui-sdk';
import '@crayonai/react-ui/styles/index.css';

export default function ChatPage() {
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) setUserEmail(user.email);
    }
    loadUser();
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <NavHeader userEmail={userEmail} />

      <main className="flex-1 overflow-hidden" style={{ height: 'calc(100vh - 57px)' }}>
        <C1Chat
          apiUrl="/api/genui-chat"
          formFactor="full-page"
          agentName="Portfolio Analyst"
          welcomeMessage={{
            title: 'Portfolio Analyst',
            description:
              'I help you identify which accounts need attention and what action to take. Ask about churn risk, expansion opportunities, renewal pipeline, or any cross-functional Sales and CS question.',
          }}
          conversationStarters={{
            variant: 'long',
            options: [
              {
                displayText: 'Which accounts have the highest churn risk?',
                prompt: 'Which accounts have the highest churn risk this quarter? Show them in a table with ARR at stake, days to renewal, and health score',
              },
              {
                displayText: 'Biggest expansion opportunities by ARR',
                prompt: 'Where are the biggest expansion opportunities? Show me accounts with high expansion pipeline relative to their current ARR in a bar chart',
              },
              {
                displayText: 'Renewal pipeline with risk assessment',
                prompt: 'Show me the renewal pipeline for the next 90 days with risk assessment, sorted by ARR at risk',
              },
              {
                displayText: 'Portfolio health across segments',
                prompt: 'Compare portfolio health across Enterprise, Mid-Market, and SMB segments with a breakdown of tier distribution',
              },
            ],
          }}
          customizeC1={{
            artifactViewMode: ArtifactViewMode.AUTO_OPEN,
          }}
        />
      </main>
    </div>
  );
}
