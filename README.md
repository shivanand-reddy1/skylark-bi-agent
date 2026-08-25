# Skylark Drones — Business Intelligence Agent

A conversational AI agent that connects to Monday.com in real-time to answer founder-level business intelligence questions about the Deals pipeline and Work Orders.

**Live Demo:** https://skylark-bi-agent-teal.vercel.app  
**Backend API:** https://skylark-bi-agent-production-0a97.up.railway.app
## Architecture

```
User
 ↓
Next.js Chat UI  (port 3000)
 ↓
Express API      (port 3001)
 ↓
Intent Extractor (OpenAI gpt-4o-mini)
 ↓
Deterministic Analytics Engine
 ↓
Normalized Monday.com Data Layer
 ↓
Monday.com GraphQL API
 ↓
Deals Board  +  Work Orders Board
```

**Key design principle:** The LLM understands the question and explains the result. All arithmetic (counts, sums, percentages, weighted values) is done in TypeScript — never by the LLM.

---

## Tech Stack

| Layer       | Technology                              |
|-------------|----------------------------------------|
| Frontend    | Next.js 14, React 18, Tailwind CSS     |
| Backend     | Node.js, Express, TypeScript           |
| AI          | OpenAI gpt-4o-mini (intent + explain)  |
| Data Source | Monday.com GraphQL API (read-only)     |
| Hosting     | Vercel (frontend) + Railway (backend)  |

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
│   │   │   └── StatusBar.tsx      # Live Monday.com connection indicator
│   │   └── lib/
│   │       └── api.ts             # API client
│   ├── .env.example
│   ├── package.json
│   └── next.config.js
│
├── DataSet/                        # Reference only — NOT used by the app
│   ├── Deal funnel Data.xlsx
│   └── Work_Order_Tracker Data.xlsx
│
├── .gitignore
├── README.md
└── DECISION_LOG.md
```

---

## Monday.com Board Setup

### Required Boards

1. **Deals Board** — Your deal funnel / CRM pipeline board
2. **Work Orders Board** — Your project/work order tracker board

### Required Column Titles (case-insensitive, flexible matching)

**Deals Board columns:**

| Semantic Field | Expected column title (examples) |
|---|---|
| Deal Name | Deal Name, Name |
| Owner Code | Owner Code, Sales Owner |
| Client Code | Client Code, Company, Customer |
| Deal Status | Deal Status, Status |
| Close Date | Close Date, Actual Close Date |
| Closure Probability | Closure Probability, Probability |
| Deal Value | Deal Value, Masked Deal Value, Amount |
| Tentative Close Date | Tentative Close Date, Expected Close Date |
| Deal Stage | Deal Stage, Stage |
| Product Deal | Product Deal, Product |
| Sector | Sector, Sector/Service, Industry |
| Created Date | Created Date, Created At |

**Work Orders Board columns:**

| Semantic Field | Expected column title |
|---|---|
| Deal Name | Deal Name Masked, Name |
| Customer Code | Customer Name Code |
| Serial # | Serial #, WO Number |
| Execution Status | Execution Status, Status |
| Probable Start Date | Probable Start Date |
| Probable End Date | Probable End Date |
| Sector | Sector |
| Amount (Excl GST) | Amount in Rupees (Excl of GST) |
| Billed Value (Excl GST) | Billed Value in Rupees (Excl of GST.) |
| Amount Receivable | Amount Receivable |

> The system uses fuzzy title matching — column IDs are discovered dynamically, never hardcoded.

### Finding Your Board IDs

1. Open your board in Monday.com
2. Look at the URL: `https://yourcompany.monday.com/boards/`**`1234567890`**
3. The number after `/boards/` is your Board ID

---

## Environment Variables

### Backend (`backend/.env`)

```env
MONDAY_API_TOKEN=your_monday_api_v2_token
DEALS_BOARD_ID=1234567890
WORK_ORDERS_BOARD_ID=0987654321
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
PORT=3001
FRONTEND_URL=http://localhost:3000
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## How to Run Locally

### Prerequisites

- Node.js 18+ and npm
- Monday.com account with API access
- OpenAI API key

### 1. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure environment

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your values

# Frontend
cp frontend/.env.example frontend/.env.local
```

### 3. Start the backend

```bash
cd backend
npm run dev
# Runs on http://localhost:3001
```

### 4. Start the frontend

```bash
cd frontend
npm run dev
# Runs on http://localhost:3000
```

### 5. Open the app

Navigate to [http://localhost:3000](http://localhost:3000)

---

## How to Deploy

### Backend → Railway (recommended)

1. Push code to GitHub
2. Create new project on [Railway](https://railway.app)
3. Connect your GitHub repo, select the `backend` folder
4. Add environment variables in Railway dashboard
5. Deploy — Railway auto-detects Node.js

### Frontend → Vercel (recommended)

1. Push code to GitHub
2. Import project on [Vercel](https://vercel.com)
3. Set root directory to `frontend`
4. Add `NEXT_PUBLIC_API_URL` = your Railway backend URL
5. Deploy

---

## Example Questions

| Question | What it does |
|---|---|
| "What is our total pipeline?" | Pipeline overview with weighted value |
| "How is our pipeline this quarter?" | Deals closing in current calendar quarter |
| "Which sector has the strongest pipeline?" | Sector-wise pipeline ranking |
| "How are Mining deals looking?" | Deep dive into a specific sector |
| "How many work orders are delayed?" | Overdue work orders (past end date, not complete) |
| "What work orders are in progress?" | Active execution status breakdown |
| "Compare Energy and Powerline" | Side-by-side sector comparison |
| "Which customers have both deals and work orders?" | Cross-board customer analysis |
| "Prepare a leadership update" | Full executive summary |
| "What is our win rate?" | Won vs lost deals with revenue |
| "How reliable is this data?" | Data quality report |

---

## Known Limitations

1. **Probability is qualitative** — The Deals board uses High/Medium/Low text (not numeric %), mapped to 80%/50%/20% for weighted pipeline calculations. ~75% of deals have no probability set.

2. **Deal values are masked** — The dataset uses masked/anonymized values. Absolute ₹ figures represent relative scale, not real amounts.

3. **Date gaps** — ~21% of deals have no close date at all, affecting quarterly pipeline accuracy.

4. **Read-only** — The agent cannot update Monday.com records.

5. **Cache TTL** — Data is cached for 5 minutes to avoid API rate limits. Ask "refresh" to clear cache manually (planned feature).

6. **Cross-board join is name-based** — Deal Name from Work Orders is matched to Deal Name from Deals. If naming is inconsistent across boards, some matches may be missed.

7. **No historical trending** — The agent analyzes current snapshot data. Time-series trend analysis is not yet implemented.
