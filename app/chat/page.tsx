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
              'Ask me anything about your 60 accounts. I can show you charts, tables, and visual breakdowns across the full portfolio.',
          }}
          conversationStarters={{
            variant: 'long',
            options: [
              {
                displayText: 'Show me all critical-tier accounts',
                prompt: 'Show me all accounts in the critical priority tier with their ARR and key metrics in a table',
              },
              {
                displayText: 'Compare ARR across segments',
                prompt: 'Show me a bar chart comparing total ARR across Enterprise, Mid-Market, and SMB segments',
              },
              {
                displayText: 'Renewal pipeline next 90 days',
                prompt: 'Which accounts renew in the next 90 days? Show them sorted by renewal date with ARR at risk',
              },
              {
                displayText: 'Portfolio health distribution',
                prompt: 'Show me a pie chart of the portfolio distribution across priority tiers',
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
