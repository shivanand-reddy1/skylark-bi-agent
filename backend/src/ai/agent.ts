/**
 * Main agent orchestrator.
 * Flow:
 * 1. Extract intent from user's message (LLM or heuristic)
 * 2. If clarification needed → return question
 * 3. Fetch & normalize data from Monday.com
 * 4. Run appropriate deterministic analytics function
 * 5. Pass results to LLM explainer to generate human-friendly response
 * 6. Return structured response to frontend
 */

import { extractIntent } from './intentExtractor';
import { explainResult } from './explainer';
import { getAppData } from '../monday/dataService';
import {
  getTotalPipeline,
  getPipelineBySector,
  getQuarterlyPipeline,
  getRevenue,
  getSectorPerformance,
  getOperationalMetrics,
  getDelayedWorkOrders,
  getCustomerPerformance,
  getCrossBoardCustomerAnalysis,
  generateLeadershipUpdate,
  getDataQualityReport,
} from '../analytics/engine';

export interface ChatResponse {
  answer: string;
  structuredData?: unknown;
  dataQualityWarnings: string[];
  source: string;
  intent: string;
  needsClarification?: boolean;
  clarificationQuestion?: string;
}

export async function handleChatMessage(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<ChatResponse> {
  // Step 1: Extract intent
  const intent = await extractIntent(message, history);

  // Step 2: Handle clarification cases
  if (
    intent.intent === 'clarification_needed' &&
    intent.clarificationNeeded &&
    intent.confidence === 'low'
  ) {
    return {
      answer: intent.clarificationNeeded,
      dataQualityWarnings: [],
      source: '',
      intent: 'clarification_needed',
      needsClarification: true,
      clarificationQuestion: intent.clarificationNeeded,
    };
  }

  // Step 3: Fetch normalized data
  let appData;
  try {
    appData = await getAppData();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return {
      answer: `I couldn't retrieve data from Monday.com right now. ${msg} Please check your configuration and try again.`,
      dataQualityWarnings: [],
      source: 'Error',
      intent: intent.intent,
    };
  }

  const { deals, workOrders, quality } = appData;
  const qualityWarnings = quality.warnings;

  // Step 4: Run deterministic analytics based on intent
  let analyticsResult: unknown;
  let contextNote = '';

  try {
    switch (intent.intent) {
      case 'total_pipeline':
      case 'active_deals':
        analyticsResult = getTotalPipeline(deals);
        break;

      case 'pipeline_by_sector': {
        const sector = intent.sector;
        if (sector) {
          const results = getPipelineBySector(deals, sector);
          analyticsResult = results.length > 0 ? results[0] : { message: `No data found for sector: ${sector}` };
        } else {
          analyticsResult = getPipelineBySector(deals);
        }
        break;
      }

      case 'quarterly_pipeline': {
        const period = intent.period === 'next_quarter' ? 'next'
          : intent.period === 'last_quarter' ? 'last'
          : 'current';
        analyticsResult = getQuarterlyPipeline(deals, period);
        contextNote = `I've interpreted "this quarter" as the current calendar quarter.`;
        break;
      }

      case 'weighted_pipeline': {
        const pipeline = getTotalPipeline(deals);
        analyticsResult = {
          weightedPipeline: pipeline.weightedPipeline,
          weightedPipelineFormatted: pipeline.weightedPipelineFormatted,
          totalPipeline: pipeline.totalPipeline,
          totalPipelineFormatted: pipeline.totalPipelineFormatted,
          dealsWithProbability: pipeline.dealsWithProbability,
          dealsExcludedFromWeighted: pipeline.dealsExcludedFromWeighted,
          note: pipeline.dealsExcludedFromWeighted > 0
            ? `${pipeline.dealsExcludedFromWeighted} deals had no probability and were excluded from weighted calculation.`
            : 'All deals with values had probability data.',
        };
        break;
      }

      case 'revenue_analysis':
        analyticsResult = getRevenue(deals);
        break;

      case 'sector_performance':
        analyticsResult = getSectorPerformance(deals, workOrders);
        break;

      case 'sector_comparison': {
        const sectors = intent.compareSectors ?? [];
        if (sectors.length === 0) {
          analyticsResult = getSectorPerformance(deals, workOrders);
        } else {
          const allPerf = getSectorPerformance(deals, workOrders);
          analyticsResult = allPerf.filter((s) =>
            sectors.some((fs) => s.sector.toLowerCase().includes(fs.toLowerCase()))
          );
        }
        break;
      }

      case 'operational_metrics':
        analyticsResult = getOperationalMetrics(workOrders);
        break;

      case 'delayed_work_orders': {
        const delayed = getDelayedWorkOrders(workOrders);
        analyticsResult = {
          count: delayed.length,
          percentage: workOrders.length > 0
            ? `${((delayed.length / workOrders.length) * 100).toFixed(1)}%`
            : '0%',
          items: delayed.slice(0, 10).map((w) => ({
            name: w.dealName,
            customer: w.customerCode,
            sector: w.normalizedSector,
            status: w.executionStatus,
            endDate: w.probableEndDate?.toISOString().split('T')[0],
            contractValue: w.amountExclGST,
          })),
        };
        break;
      }

      case 'customer_performance':
        analyticsResult = getCustomerPerformance(deals, workOrders);
        break;

      case 'cross_board_analysis': {
        const crossResults = getCrossBoardCustomerAnalysis(deals, workOrders, intent.sector);
        analyticsResult = {
          total: crossResults.length,
          bothBoards: crossResults.filter((c) => c.relationship === 'both').length,
          dealsOnly: crossResults.filter((c) => c.relationship === 'deals_only').length,
          woOnly: crossResults.filter((c) => c.relationship === 'wo_only').length,
          customers: crossResults
            .filter((c) => c.relationship === 'both')
            .slice(0, 10),
        };
        break;
      }

      case 'leadership_update':
        analyticsResult = generateLeadershipUpdate(deals, workOrders, quality);
        break;

      case 'data_quality':
        analyticsResult = getDataQualityReport(quality);
        break;

      default:
        // Fallback to pipeline overview for unknown intents
        analyticsResult = getTotalPipeline(deals);
        contextNote = `I defaulted to a pipeline overview. You can ask about sectors, work orders, specific customers, or request a leadership update.`;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Analytics error';
    console.error('[Agent] Analytics error:', msg);
    return {
      answer: `I ran into an issue while calculating the analytics. ${msg}`,
      dataQualityWarnings: qualityWarnings,
      source: 'Monday.com (live)',
      intent: intent.intent,
    };
  }

  // Step 5: Generate LLM explanation
  const fullMessage = contextNote ? `${message}\n\nNote: ${contextNote}` : message;
  const explained = await explainResult({
    question: fullMessage,
    analyticsResult,
    dataQualityWarnings: qualityWarnings,
  });

  return {
    answer: explained.answer,
    structuredData: explained.structuredData,
    dataQualityWarnings: explained.dataQualityWarnings,
    source: explained.source,
    intent: intent.intent,
  };
}
