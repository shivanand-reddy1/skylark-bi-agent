/**
 * LLM-powered explainer.
 * Takes the results of deterministic analytics and generates
 * founder-friendly, concise explanations.
 * The LLM receives RESULTS, not raw data — it cannot alter the numbers.
 */

import { chatComplete } from './llmClient';

let _unused: unknown; // keep openai import unused warning away

const EXPLAINER_SYSTEM_PROMPT = `You are Skylark Drones' Business Intelligence assistant.
You help founders and executives understand their business data.

RULES:
1. Be concise — executives are busy. Aim for 3-5 sentences max per section.
2. Lead with the most important insight, not background.
3. Use ₹ for Indian Rupees. Use "Cr" for crores, "L" for lakhs.
4. If data quality issues exist, mention them briefly at the end.
5. Suggest 1-2 actionable next steps when relevant.
6. NEVER invent numbers. Only use the data provided.
7. Respond in a professional but direct tone.
8. Format your response as structured text, not JSON.`;

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

/** Fallback when LLM is unavailable — plain text from structured data */
function fallbackExplanation(ctx: ExplainerContext): string {
  const data = ctx.analyticsResult as Record<string, unknown>;
  const lines: string[] = [`Here is the analysis based on your question: "${ctx.question}"`, ''];

  if (typeof data === 'object' && data !== null) {
    for (const [key, value] of Object.entries(data)) {
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
        lines.push(`${label}: ${value}`);
      }
    }
  }

  if (ctx.dataQualityWarnings.length > 0) {
    lines.push('');
    lines.push('Data quality notes:');
    ctx.dataQualityWarnings.forEach((w) => lines.push(`- ${w}`));
  }

  return lines.join('\n');
}
