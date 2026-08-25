# Skylark Drones — Monday.com Business Intelligence Agent

A conversational AI agent that connects live to Monday.com and answers founder-level business intelligence questions about the Deals pipeline and Work Orders.

**Live Demo:** [Add your Vercel URL here after deployment]  
**Backend API:** [Add your Railway URL here after deployment]

---

## Approach

The core idea is a **hybrid intelligence system**:

- **Deterministic code** handles all analytics — counting, summing, filtering, percentages. Numbers are never trusted to an LLM.
- **LLM (OpenAI gpt-4o-mini)** handles two things only: understanding what the user is asking, and explaining the result in natural language.
- **Heuristic fallback** — if the LLM is unavailable, keyword-based intent extraction and structured text formatting keep the app fully functional.

This means the app gives correct, reproducible answers every time — the LLM cannot hallucinate a revenue number because it never calculates one.

---

## Architecture

```
User
 ↓
Next.js Chat UI  (Vercel, port 3000)
 ↓
Express REST API  (Railway, port 3001)
 ↓
AI Agent Orchestrator
 ├── Intent Extractor (OpenAI gpt-4o-mini + heuristic fallback)
 ├── Deterministic Analytics Engine (pure TypeScript)
 └── LLM Explainer (OpenAI gpt-4o-mini + text fallback)
 ↓
Data Normalization Layer
 ↓
Monday.com GraphQL API (live, read-only)
 ↓
Deals Board  +  Work Orders Board
```

### Key architectural decisions

1. **Backend as secure proxy** — API keys never reach the browser. All Monday.com and OpenAI calls happen server-side.
2. **Dynamic column mapping** — Column IDs are discovered at runtime by matching column titles. Nothing is hardcoded. Works on any Monday board with compatible column names.
3. **5-minute TTL cache** — Board data is cached for 5 minutes to respect Monday's API rate limits while keeping data fresh for a conversation session.
4. **No database** — Monday.com is the single source of truth. No sync complexity.

---

## Tech Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Frontend | Next.js 14, React 18, Tailwind CSS | Fast setup, great DX, Vercel-native |
| Backend | Node.js, Express, TypeScript | Type safety, fast prototyping |
| AI | OpenAI gpt-4o-mini | Cost-efficient, strong instruction following |
| Data Source | Monday.com GraphQL API | Assignment requirement, read-only |
| Hosting | Vercel (frontend) + Railway (backend) | Free tiers, GitHub-connected CI/CD |

---

## Folder Structure

```
Project/
├── backend/
│   ├── src/
│   │   ├── monday/
│   │   │   ├── client.ts          # GraphQL API client + pagination
│   │   │   ├── columnMapper.ts    # Dynamic column ID → semantic field mapping
│   │   │   └── dataService.ts     # Data fetching + 5-min TTL cache
│   │   ├── normalization/
│   │   │   ├── types.ts           # NormalizedDeal, NormalizedWorkOrder types
│   │   │   └── normalizer.ts      # Date/sector/status/value normalization
│   │   ├── analytics/
│   │   │   └── engine.ts          # All deterministic analytics functions
│   │   ├── ai/
│   │   │   ├── intentExtractor.ts # LLM + heuristic intent extraction
│   │   │   ├── explainer.ts       # LLM explanation generator
│   │   │   └── agent.ts           # Main orchestrator
│   │   ├── routes/
│   │   │   ├── chat.ts            # POST /api/chat
│   │   │   └── health.ts          # GET /api/health
│   │   └── index.ts               # Express server
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx           # Main chat page
│   │   │   ├── layout.tsx         # Root layout
│   │   │   └── globals.css        # Global styles
│   │   ├── components/
│   │   │   ├── ChatMessage.tsx    # Message bubbles + typing indicator
│   │   │   ├── SuggestedQuestions.tsx
│   │   │   └── StatusBar.tsx      # Live Monday.com connection status
│   │   └── lib/
│   │       └── api.ts             # API client
│   ├── .env.example
│   └── package.json
│
├── DataSet/                        # Reference only — not used by the app
├── .gitignore
├── README.md
├── DECISION_LOG.md
└── TEST_CHECKLIST.md
```

---

## Monday.com Setup

### 1. Import the data boards

Import the two Excel files as separate Monday.com boards:

- `Deal funnel Data.xlsx` → name it **"Deal funnel Data"**
- `Work_Order_Tracker Data.xlsx` → name it **"Work_Order_Tracker Data"**

When importing the Work Orders file, select **Row 2 as the header row** (Row 1 is blank).

### 2. Get your Board IDs

Open each board — the ID is in the URL:
```
https://yourcompany.monday.com/boards/XXXXXXXXXX
                                      ^^^^^^^^^^
                                      This is your Board ID
```

### 3. Get your API Token

Go to: `https://yourcompany.monday.com/apps/manage/tokens`  
Click **Copy** next to your API token.

---

## Environment Variables

### Backend (`backend/.env`)

```env
MONDAY_API_TOKEN=eyJhbGciOiJIUzI1NiJ9...
DEALS_BOARD_ID=5030844202
WORK_ORDERS_BOARD_ID=5030844329
OPENAI_API_KEY=sk-...
PORT=3001
FRONTEND_URL=http://localhost:3000
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## How to Run Locally

```bash
# 1. Install dependencies
cd backend && npm install
cd ../frontend && npm install

# 2. Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env with your real values

cp frontend/.env.example frontend/.env.local

# 3. Start backend (Terminal 1)
cd backend && npm run dev
# → http://localhost:3001

# 4. Start frontend (Terminal 2)
cd frontend && npm run dev
# → http://localhost:3000
```

---

## How to Deploy

### Backend → Railway

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Select your repo, set root directory to `backend`
3. Add all environment variables in the Variables tab
4. Deploy → copy the generated URL

### Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
2. Set root directory to `frontend`
3. Add `NEXT_PUBLIC_API_URL` = your Railway backend URL
4. Deploy → copy the generated URL

---

## Example Questions

| Question | What it returns |
|----------|----------------|
| "What is our total pipeline?" | Total + weighted pipeline, deal count |
| "How many deals close this quarter?" | Quarterly pipeline forecast |
| "Which sector has the strongest pipeline?" | Sector ranking by pipeline value |
| "How is Mining sector looking?" | Deep dive into Mining deals |
| "How many work orders are delayed?" | Overdue WO count and list |
| "Compare Mining and Powerline" | Side-by-side sector comparison |
| "Which customers have both deals and work orders?" | Cross-board customer analysis |
| "Prepare a leadership update" | Full executive summary |
| "What is our win rate?" | Won/lost deals with revenue |
| "How reliable is this data?" | Data quality report |

---

## Assumptions Made

1. **Probability is qualitative** — The Deals board uses High/Medium/Low text, mapped to 80%/50%/20% for weighted pipeline. No numeric probability exists in the data.
2. **"Current quarter"** means the current calendar quarter unless specified otherwise.
3. **Cross-board join** uses Deal Name as the linking key between Deals and Work Orders boards.
4. **Currency is INR (₹)** — values formatted as Lakhs (L) or Crores (Cr).
5. **Delayed work order** = probable end date is in the past AND execution status is not Completed/Cancelled.
6. **Leadership update** = full executive brief covering pipeline, revenue, operations, top sectors, top customers, and data quality caveats.

---

## AI Tools Used

| Tool | Purpose |
|------|---------|
| OpenAI gpt-4o-mini | Intent extraction from natural language queries |
| OpenAI gpt-4o-mini | Generating founder-friendly explanations of analytics results |
| Heuristic fallback | Keyword-based intent extraction when LLM is unavailable |
| Kiro IDE (AI assistant) | Used during development for code generation and architecture |

---

## Trade-offs

| Decision | Choice | Reason |
|----------|--------|--------|
| LLM for all reasoning vs hybrid | Hybrid — LLM for language only | Financial figures must be deterministically correct |
| Real-time vs cached data | 5-min TTL cache | Balances freshness with API rate limit protection |
| Database vs no database | No database | Monday.com is source of truth; avoids sync complexity |
| GPT-4 vs GPT-4o-mini | GPT-4o-mini | Cost efficiency; quality difference negligible for intent extraction |
| MCP vs REST API | REST/GraphQL API | More flexible, works with any board structure, easier to debug |

---

## Challenges Faced

1. **Messy real-world data** — 75% of deals had no probability set, dates were stored as Excel serial numbers, and sector names were inconsistent across boards. Solved with a multi-format normalizer and alias mapping.

2. **Dynamic column mapping** — Monday.com auto-generates column IDs (e.g., `status_1`, `date_2`) that change per board. Solved by fetching column metadata and matching by title rather than ID.

3. **Work Orders file structure** — The Excel file had an empty Row 1 with headers on Row 2, causing import confusion. Handled by detecting and skipping blank header rows.

4. **Cross-board join without a shared key** — The two boards share deal names but use different customer code formats. Solved with normalized lowercase string matching.

5. **No OpenAI quota** — When OpenAI quota is exhausted, the app automatically falls back to heuristic intent extraction and structured text responses so the app remains functional.

---

## Potential Improvements

1. **Streaming responses** — Stream LLM tokens to the UI for faster perceived response time.
2. **Charts and visualizations** — Render pipeline bar charts and sector comparisons inline in the chat.
3. **Time-series trending** — Track pipeline changes over time using periodic snapshots.
4. **Manual cache refresh** — Allow user to type "refresh" to pull latest data mid-session.
5. **Semantic fuzzy matching** — Use embeddings for more robust cross-board customer name matching.
6. **Multi-board support** — Generalize the board mapper to support any Monday board with zero code changes.
7. **Authentication** — Add user sessions if multiple people need isolated conversation histories.
8. **Retry with backoff** — Exponential backoff for Monday API rate limit (429) responses.

---

## Known Limitations

1. **~75% of deals have no probability** — Weighted pipeline excludes these, which is noted in every response.
2. **Deal values are masked** — The dataset uses anonymized values. Absolute ₹ figures represent relative scale.
3. **~21% of deals have no close date** — These are excluded from quarterly pipeline filters.
4. **Read-only** — The agent cannot update Monday.com records.
5. **Cross-board join is name-based** — Inconsistent naming across boards may cause some matches to be missed.
6. **No historical trending** — Analyzes current snapshot only, not changes over time.
