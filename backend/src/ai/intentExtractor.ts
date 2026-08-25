/**
 * Intent extractor — converts natural-language questions into structured intents.
 * Uses the LLM only for language understanding, NOT for arithmetic.
 */

export type IntentType =
  | 'total_pipeline'
  | 'pipeline_by_sector'
  | 'quarterly_pipeline'
  | 'weighted_pipeline'
  | 'revenue_analysis'
  | 'sector_performance'
  | 'sector_comparison'
  | 'operational_metrics'
  | 'delayed_work_orders'
  | 'customer_performance'
  | 'cross_board_analysis'
  | 'leadership_update'
  | 'data_quality'
  | 'active_deals'
  | 'clarification_needed'
  | 'unknown';

export interface ExtractedIntent {
  intent: IntentType;
  sector?: string;
  period?: 'current_quarter' | 'next_quarter' | 'last_quarter' | 'all_time';
  customer?: string;
  compareSectors?: string[];
  confidence: 'high' | 'medium' | 'low';
  clarificationNeeded?: string;
  raw: string;
}

import OpenAI from 'openai';

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured. Please set it in your .env file.');
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

const INTENT_SYSTEM_PROMPT = `You are an intent extraction assistant for a drone company's business intelligence tool.
Extract the user's intent from their question and return ONLY a valid JSON object.

Available intents:
- total_pipeline: overall pipeline overview, total deals, pipeline health
- pipeline_by_sector: pipeline for a specific sector (Mining, Powerline, Renewables, DSP, Aviation, Railways, Construction, Manufacturing, Security & Surveillance, Others, Tender)
- quarterly_pipeline: pipeline closing in a quarter (current/next/last)
- weighted_pipeline: weighted/probability-adjusted pipeline
- revenue_analysis: won deals, lost deals, win rate, revenue
- sector_performance: performance comparison across sectors
- sector_comparison: explicitly comparing 2+ sectors
- operational_metrics: work order stats, completion rates, billing
- delayed_work_orders: overdue, delayed, late projects
- customer_performance: top customers, customer analysis
- cross_board_analysis: customers with both deals AND work orders
- leadership_update: executive summary, board update, overview of everything
- data_quality: data reliability, missing values, accuracy
- active_deals: currently open/active deals
- clarification_needed: question is too vague to answer without more info
- unknown: cannot determine intent

Return JSON only, no explanation:
{
  "intent": "<intent_type>",
  "sector": "<sector name if mentioned, else null>",
  "period": "<current_quarter|next_quarter|last_quarter|all_time|null>",
  "customer": "<customer code/name if mentioned, else null>",
  "compareSectors": ["<sector1>", "<sector2>"] or null,
  "confidence": "<high|medium|low>",
  "clarificationNeeded": "<short clarifying question if needed, else null>"
}`;

export async function extractIntent(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<ExtractedIntent> {
  // Rule-based pre-classification for speed and reliability
  const lower = message.toLowerCase();

  // Strong keyword signals — skip LLM for clear cases
  if (matchesKeywords(lower, ['leadership update', 'executive summary', 'board update', 'prepare update', 'leadership report'])) {
    return { intent: 'leadership_update', confidence: 'high', raw: message };
  }
  if (matchesKeywords(lower, ['data quality', 'reliability', 'how accurate', 'missing data', 'data issues'])) {
    return { intent: 'data_quality', confidence: 'high', raw: message };
  }
  if (matchesKeywords(lower, ['delayed', 'overdue', 'late', 'behind schedule'])) {
    return { intent: 'delayed_work_orders', confidence: 'high', raw: message };
  }
  if (matchesKeywords(lower, ['win rate', 'won deals', 'revenue', 'closed deals', 'lost deals'])) {
    return { intent: 'revenue_analysis', confidence: 'high', raw: message };
  }

  // LLM for everything else
  try {
    const openai = getOpenAI();
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: INTENT_SYSTEM_PROMPT },
      ...history.slice(-4).map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ];

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages,
      temperature: 0,
      max_tokens: 300,
      response_format: { type: 'json_object' },
    });

    const raw = response.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as Partial<ExtractedIntent>;

    return {
      intent: (parsed.intent as IntentType) ?? 'unknown',
      sector: parsed.sector ?? undefined,
      period: parsed.period ?? undefined,
      customer: parsed.customer ?? undefined,
      compareSectors: parsed.compareSectors ?? undefined,
      confidence: parsed.confidence ?? 'medium',
      clarificationNeeded: parsed.clarificationNeeded ?? undefined,
      raw: message,
    };
  } catch (err) {
    console.error('[IntentExtractor] LLM failed, falling back to heuristics:', err);
    return extractIntentHeuristic(message);
  }
}

function matchesKeywords(text: string, keywords: string[]): boolean {
  return keywords.some((k) => text.includes(k));
}

/** Fallback heuristic intent extraction — no LLM dependency */
export function extractIntentHeuristic(message: string): ExtractedIntent {
  const lower = message.toLowerCase();

  const SECTORS = ['mining', 'powerline', 'renewables', 'dsp', 'aviation', 'railways', 'construction', 'manufacturing', 'security', 'surveillance', 'tender'];
  const foundSectors = SECTORS.filter((s) => lower.includes(s));

  const period =
    lower.includes('this quarter') || lower.includes('current quarter')
      ? 'current_quarter'
      : lower.includes('next quarter')
      ? 'next_quarter'
      : lower.includes('last quarter')
      ? 'last_quarter'
      : undefined;

  if (lower.includes('leadership') || lower.includes('executive') || lower.includes('board update')) {
    return { intent: 'leadership_update', confidence: 'high', raw: message };
  }
  if (lower.includes('delay') || lower.includes('overdue') || lower.includes('late')) {
    return { intent: 'delayed_work_orders', confidence: 'high', raw: message };
  }
  if (lower.includes('work order') || lower.includes('execution') || lower.includes('operational')) {
    return { intent: 'operational_metrics', confidence: 'medium', raw: message };
  }
  if (foundSectors.length >= 2 || lower.includes('compare') || lower.includes('vs')) {
    return {
      intent: 'sector_comparison',
      compareSectors: foundSectors.slice(0, 2),
      confidence: 'medium',
      raw: message,
    };
  }
  if (foundSectors.length === 1) {
    return {
      intent: 'pipeline_by_sector',
      sector: foundSectors[0],
      period,
      confidence: 'medium',
      raw: message,
    };
  }
  if (lower.includes('quarter') || lower.includes('q1') || lower.includes('q2') || lower.includes('q3') || lower.includes('q4')) {
    return { intent: 'quarterly_pipeline', period, confidence: 'medium', raw: message };
  }
  if (lower.includes('pipeline') || lower.includes('deals')) {
    return { intent: 'total_pipeline', period, confidence: 'medium', raw: message };
  }
  if (lower.includes('customer') || lower.includes('client')) {
    return { intent: 'customer_performance', confidence: 'medium', raw: message };
  }
  if (lower.includes('revenue') || lower.includes('won') || lower.includes('win rate')) {
    return { intent: 'revenue_analysis', confidence: 'medium', raw: message };
  }
  if (lower.includes('sector') || lower.includes('industry')) {
    return { intent: 'sector_performance', confidence: 'medium', raw: message };
  }
  if (lower.includes('data quality') || lower.includes('accurate') || lower.includes('reliable')) {
    return { intent: 'data_quality', confidence: 'medium', raw: message };
  }

  // Too vague
  if (lower.split(' ').length <= 3) {
    return {
      intent: 'clarification_needed',
      clarificationNeeded:
        'Could you be more specific? For example: pipeline overview, sector performance, work order status, or a leadership update?',
      confidence: 'low',
      raw: message,
    };
  }

  return { intent: 'total_pipeline', confidence: 'low', raw: message };
}
