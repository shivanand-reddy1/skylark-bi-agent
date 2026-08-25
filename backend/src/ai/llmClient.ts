/**
 * Unified LLM client.
 * Tries OpenAI first. If it fails (quota, invalid key, etc.),
 * automatically falls back to Google Gemini.
 * Existing code calls this instead of OpenAI directly.
 */

import OpenAI from 'openai';

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI | null {
  try {
    const key = process.env.OPENAI_API_KEY;
    if (!key || key.startsWith('your_') || key.length < 20) return null;
    if (!openaiClient) openaiClient = new OpenAI({ apiKey: key });
    return openaiClient;
  } catch {
    return null;
  }
}

async function callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY; // try dedicated key first
  if (!key || key.length < 20) throw new Error('No Gemini API key');

  const model = 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  const body = {
    contents: [
      {
        parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 800,
    },
  };

  const fetch = (await import('node-fetch')).default;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err.substring(0, 200)}`);
  }

  const data = await response.json() as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned empty response');
  return text;
}

async function callGeminiJSON(systemPrompt: string, userPrompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
  if (!key || key.length < 20) throw new Error('No Gemini API key');

  const model = 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  const body = {
    contents: [
      {
        parts: [{ text: `${systemPrompt}\n\nIMPORTANT: Respond with valid JSON only, no markdown.\n\n${userPrompt}` }],
      },
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 300,
      responseMimeType: 'application/json',
    },
  };

  const fetch = (await import('node-fetch')).default;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini JSON API error ${response.status}: ${err.substring(0, 200)}`);
  }

  const data = await response.json() as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned empty response');
  return text;
}

/** Chat completion — tries OpenAI, falls back to Gemini */
export async function chatComplete(
  systemPrompt: string,
  userPrompt: string,
  options: { json?: boolean; maxTokens?: number } = {}
): Promise<string> {
  // Try OpenAI first
  const openai = getOpenAI();
  if (openai) {
    try {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages,
        temperature: options.json ? 0 : 0.3,
        max_tokens: options.maxTokens ?? 800,
        ...(options.json ? { response_format: { type: 'json_object' as const } } : {}),
      });
      const text = response.choices[0]?.message?.content;
      if (text) return text;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[LLMClient] OpenAI failed, trying Gemini:', msg.substring(0, 100));
    }
  }

  // Fall back to Gemini
  try {
    if (options.json) {
      return await callGeminiJSON(systemPrompt, userPrompt);
    } else {
      return await callGemini(systemPrompt, userPrompt);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[LLMClient] Gemini also failed:', msg.substring(0, 100));
    throw new Error('Both OpenAI and Gemini are unavailable');
  }
}
