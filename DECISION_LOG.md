# Decision Log — Skylark Drones BI Agent

**Author:** Engineering  
**Date:** August 2026  
**Scope:** Architecture and implementation decisions for the Monday.com BI Agent prototype

---

## 1. Key Assumptions

- **Monday.com is the source of truth.** All data comes live from the API. No local data store is introduced.
- **Deals board columns follow the observed Excel schema** — Deal Name, Status, Stage, Sector, Probability (High/Medium/Low), Deal Value, Tentative Close Date. The system maps these dynamically by title, not by hardcoded column IDs.
- **Work Orders header is on row 2** of the Excel export (row 1 is empty). This pattern is mirrored on Monday, where column metadata is fetched via the API before processing items.
- **Probability is qualitative** (High/Medium/Low), not a numeric percentage. Mapped to 0.8 / 0.5 / 0.2 for weighted pipeline. If missing, the deal is excluded from weighted calculations with a visible warning — no value is invented.
- **Currency is Indian Rupees (₹)**. Values are presented as Lakhs (L) or Crores (Cr) for executive readability.
- **"Current quarter"** means the current calendar quarter (Q1 = Jan–Mar, Q2 = Apr–Jun, etc.) unless the user specifies otherwise.
- **Cross-board join** uses the Deal Name field, which appears in both boards. Customer codes are treated as secondary identifiers.

---

## 2. Why Monday.com GraphQL API Instead of MCP

The MCP (Monday.com Code Platform) approach was considered but ruled out because:

- **MCP requires board-specific scripted automations** and is tightly coupled to Monday's internal execution environment.
- **The GraphQL API is universal** — it works with any board, any column structure, from any external client.
- **Dynamic column discovery** is only possible via the REST/GraphQL API (`boards { columns { id title } }`). MCP automations assume a known schema.
- **Prototyping speed**: The GraphQL API has excellent documentation and a 6-hour timeline requires the fastest reliable path.
- **Read-only requirement**: The use case is BI querying, not workflow automation — MCP's strengths (triggers, automations) are not needed here.

---

## 3. Architecture Decisions

### 3a. Deterministic Analytics + LLM Explanation (Hybrid Approach)

**Decision:** Use TypeScript code for all filtering, counting, summing, and percentage calculations. Use the LLM only for intent extraction and explanation generation.

**Rationale:**  
LLMs are probabilistic. They hallucinate numbers. A weighted pipeline calculation or sector comparison must be exactly correct — these are financial figures a founder will act on. Deterministic code guarantees reproducible, auditable results. The LLM's strength is language: understanding "how's energy doing this quarter?" and explaining "₹4.2 Cr pipeline with 3 deals closing in Q3" in human terms.

**Trade-off:** More code to write. Worth it for correctness and explainability.

### 3b. Heuristic Fallback for Intent Extraction

**Decision:** Implement a rule-based intent extractor as a fallback when OpenAI is unavailable.

**Rationale:** The LLM API may be slow, rate-limited, or unavailable. A keyword-based fallback ensures the app degrades gracefully rather than failing completely. This also reduces latency for common, unambiguous queries.

### 3c. 5-Minute Cache

**Decision:** Cache normalized board data for 5 minutes.

**Rationale:** Monday.com has API rate limits. A conversational agent may send multiple requests in a session. Caching at the data layer (not the response layer) means all analytics runs on the same snapshot, ensuring consistency within a conversation. 5 minutes balances freshness with API conservation.

### 3d. Single Backend + Next.js Frontend

**Decision:** Express backend (port 3001) + Next.js frontend (port 3000), deployed separately.

**Rationale:** API token must never be exposed to the browser. The backend acts as a secure proxy to both Monday.com and OpenAI. Next.js API routes were considered but would require a single deployment — keeping backend separate allows independent scaling and cleaner separation of concerns.

---

## 4. Data Normalization Strategy

**Problem:** Real-world board data contains inconsistencies — sector names in different cases, dates as Excel serial numbers, probability as text, duplicate header rows.

**Solution:**
- **Sectors:** Case-insensitive alias map (e.g., "power line", "Powerline", "POWERLINE" → "Powerline").
- **Dates:** Multi-format parser handles ISO strings, DD/MM/YYYY, Excel serial numbers (days since 1899-12-30), and Monday.com JSON date column values.
- **Probability:** Text → numeric mapping with no invention. Missing probability → `null`, excluded from weighted calculations with a data-quality warning.
- **Numbers:** Strip currency symbols, commas, whitespace before parsing.
- **Status:** Case-insensitive normalization to canonical enum values (Open, Won, Lost, Dead, On Hold).

**Record preservation:** No record is discarded due to data quality issues. Issues are tracked per-record in `_issues[]` and surfaced as aggregate warnings to the user.

---

## 5. Handling Missing Values

| Field | If Missing |
|---|---|
| Probability | Excluded from weighted pipeline. Warning shown. |
| Deal Value | Excluded from ₹ totals. Count still included. |
| Close Date | Excluded from quarter-based filters. Warning shown. |
| Sector | Normalized to "Unknown". Warning shown. |
| WO Amount | Excluded from contract value totals. |
| WO End Date | Cannot determine delay status. `isDelayed = false`. |

**Principle:** Always exclude gracefully, never invent. Communicate exclusions clearly.

---

## 6. Handling Ambiguity

**Decision:** Use a two-tier approach.
1. If a question is very short (≤3 words) or structurally ambiguous (e.g., "How are we doing?"), return a clarifying question.
2. For reasonable assumptions (e.g., "this quarter" → current calendar quarter), state the assumption in the response rather than asking.

**Rationale:** Over-asking for clarification is annoying. Founders want fast answers. Stating assumptions is transparent and fast. True ambiguity (cannot determine at all) warrants a clarifying question.

---

## 7. Leadership Update Interpretation

**Decision:** A "leadership update" generates a structured executive brief containing: pipeline summary, quarterly forecast, revenue (won/lost), operational metrics, top 5 sectors, top 5 customers, delayed work order count, and data quality caveats.

**Rationale:** This mirrors the typical content of a Monday morning founder standup or investor update. It is comprehensive but structured — the LLM is given this structured data and asked to narrate it concisely.

---

## 8. Trade-offs

| Trade-off | Choice Made | Reason |
|---|---|---|
| LLM for all reasoning | Hybrid (LLM + deterministic code) | Accuracy of financial figures is non-negotiable |
| Real-time vs. cached data | 5-min TTL cache | API rate limits; freshness is acceptable at this interval |
| Full search/filter UI | Chat-only interface | Simpler; natural language is more flexible |
| Database | None (Monday as source of truth) | Avoids sync complexity; correct for this use case |
| GPT-4 vs GPT-4o-mini | GPT-4o-mini (default) | Cost; for intent extraction, quality difference is negligible |

---

## 9. What Would Be Improved With More Time

1. **Streaming responses** — Stream LLM tokens to the UI for faster perceived response time.
2. **Data refresh command** — Allow user to type "refresh" to invalidate cache mid-session.
3. **Time-series trending** — Track pipeline changes over time (requires periodic snapshots or Monday's activity log API).
4. **Rich structured cards** — Render pipeline charts, sector bar charts, and deal tables inline in the chat.
5. **Multi-board generalization** — Abstract the board mapping further to support any Monday board structure with zero code changes.
6. **Rate limit handling with retry** — Exponential backoff for Monday API 429 responses.
7. **Auth/multi-user** — Add session management if multiple users need isolated conversations.
8. **Semantic search on deal names** — Currently joins are exact string matches; fuzzy matching would handle name variations.
