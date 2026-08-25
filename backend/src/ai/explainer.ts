/**
 * LLM-powered explainer.
 * Takes the results of deterministic analytics and generates
 * founder-friendly, concise explanations.
 * The LLM receives RESULTS, not raw data — it cannot alter the numbers.
 */

import { chatComplete } from './llmClient';

let _unused: unknown; // keep openai import unused warning away

const EXPLAINER_SYSTEM_PROMPT = `You are Skylark Drones' Business Intelligence assistant helping founders and executives.

RESPONSE FORMAT — always use this structure:
**Summary:** [1-2 sentence executive summary of the key finding]

**Key Metrics:**
- [Metric 1]: [Value]
- [Metric 2]: [Value]

**Key Insights:**
- [Insight 1]
- [Insight 2]

**Recommended Focus:**
- [Action 1]

RULES:
1. Be concise — executives are busy.
2. Use ₹ for Indian Rupees. Use "Cr" for crores, "L" for lakhs.
3. NEVER invent numbers. Only use the data provided.
4. If data quality issues exist, mention them briefly at the end as "Data Caveats".
5. Always lead with the most important business insight.
6. Professional but direct tone — no fluff.`;

export interface ExplainerContext {
  question: string;
  analyticsResult: unknown;
  dataQualityWarnings: string[];
  companyContext?: string;
}

export interface ExplainedResponse {
  answer: string;
  structuredData?: unknown;
  dataQualityWarnings: string[];
  source: string;
}

export async function explainResult(ctx: ExplainerContext): Promise<ExplainedResponse> {
  const warnings = ctx.dataQualityWarnings;
  const resultText = JSON.stringify(ctx.analyticsResult, null, 2);

  const userPrompt = `User question: "${ctx.question}"

Analytics result (pre-calculated, accurate):
${resultText}

${warnings.length > 0 ? `Data quality notes:\n${warnings.map((w) => `- ${w}`).join('\n')}` : ''}

Please provide a concise, founder-friendly response based on this data.`;

  try {
    const answer = await chatComplete(EXPLAINER_SYSTEM_PROMPT, userPrompt, { maxTokens: 800 });
    return {
      answer,
      structuredData: ctx.analyticsResult,
      dataQualityWarnings: warnings,
      source: 'Monday.com (live)',
    };
  } catch (err) {
    console.error('[Explainer] All LLMs failed, using fallback:', err);
    return {
      answer: fallbackExplanation(ctx),
      structuredData: ctx.analyticsResult,
      dataQualityWarnings: warnings,
      source: 'Monday.com (live) — AI explanation unavailable',
    };
  }
}

/** Fallback when LLM is unavailable — professional structured text from analytics data */
function fallbackExplanation(ctx: ExplainerContext): string {
  const data = ctx.analyticsResult as Record<string, unknown>;
  const lines: string[] = [];

  // Build a professional structured response
  lines.push(`## Analysis: ${ctx.question}`);
  lines.push('');

  if (typeof data === 'object' && data !== null) {
    // Group formatted vs raw fields
    const formattedPairs: string[] = [];
    const numericPairs: string[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith('_') || Array.isArray(value) || typeof value === 'object') continue;
      const label = key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (s) => s.toUpperCase())
        .trim();

      if (key.endsWith('Formatted') || key.endsWith('Rate') || key.endsWith('formatted')) {
        formattedPairs.push(`**${label.replace(' Formatted', '')}:** ${value}`);
      } else if (typeof value === 'number' && !key.toLowerCase().includes('pipeline') && !key.toLowerCase().includes('value')) {
        numericPairs.push(`**${label}:** ${value}`);
      }
    }

    if (formattedPairs.length > 0) {
      lines.push('### Key Metrics');
      formattedPairs.forEach(p => lines.push(`- ${p}`));
      lines.push('');
    }

    if (numericPairs.length > 0) {
      lines.push('### Additional Details');
      numericPairs.forEach(p => lines.push(`- ${p}`));
      lines.push('');
    }
  }

  if (ctx.dataQualityWarnings.length > 0) {
    lines.push('### Data Quality Notes');
    ctx.dataQualityWarnings.forEach((w) => lines.push(`- ${w}`));
  }

  return lines.join('\n');
}
