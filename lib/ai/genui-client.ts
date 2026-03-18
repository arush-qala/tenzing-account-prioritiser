// ---------------------------------------------------------------------------
// Thesys C1 Client (singleton) — OpenAI-compatible, for generative UI
// ---------------------------------------------------------------------------

import OpenAI from 'openai';

let client: OpenAI | null = null;

export function getGenuiClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.THESYS_API_KEY,
      baseURL: 'https://api.thesys.dev/v1/embed',
    });
  }
  return client;
}
