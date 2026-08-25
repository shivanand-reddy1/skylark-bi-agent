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

  lines.push(`## ${ctx.question}`);
  lines.push('');
  lines.push('**Key Metrics:**');
  lines.push('');

  if (typeof data === 'object' && data !== null) {
    // Extract all formatted values (end with 'Formatted')
    const metrics: string[] = [];
    const counts: string[] = [];

    const extractValues = (obj: Record<string, unknown>, prefix = '') => {
      for (const [key, value] of Object.entries(obj)) {
        if (key.startsWith('_') || value === null || value === undefined) continue;
        const label = (prefix ? `${prefix} ` : '') + key
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, s => s.toUpperCase())
          .trim();

        if (key.endsWith('Formatted') && typeof value === 'string') {
          const cleanLabel = label.replace(' Formatted', '');
          metrics.push(`- **${cleanLabel}:** ${value}`);
        } else if (typeof value === 'number' && Number.isInteger(value) && value < 10000) {
          counts.push(`- **${label}:** ${value}`);
        } else if (typeof value === 'string' && !key.endsWith('Formatted') && value.length < 50) {
          counts.push(`- **${label}:** ${value}`);
        } else if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
          extractValues(value as Record<string, unknown>);
        }
      }
    };

    extractValues(data);

    if (metrics.length > 0) {
      metrics.forEach(m => lines.push(m));
    }
    if (counts.length > 0) {
      lines.push('');
      lines.push('**Details:**');
      counts.slice(0, 8).forEach(c => lines.push(c));
    }
  }

  if (ctx.dataQualityWarnings.length > 0) {
    lines.push('');
    lines.push('**Data Caveats:**');
    ctx.dataQualityWarnings.forEach((w) => lines.push(`- ${w}`));
  }

  return lines.join('\n');
}
