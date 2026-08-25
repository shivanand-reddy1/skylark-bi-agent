# Manual Test Checklist — Skylark BI Agent

Run these test questions after setup to verify all functionality.

## Pre-Test Requirements
- [ ] Backend running (`npm run dev` in `/backend`)
- [ ] Frontend running (`npm run dev` in `/frontend`)
- [ ] `MONDAY_API_TOKEN` set and valid
- [ ] `DEALS_BOARD_ID` and `WORK_ORDERS_BOARD_ID` configured
- [ ] `OPENAI_API_KEY` set
- [ ] Monday boards populated with data

---

## Test Cases

### 1. Total Pipeline
**Question:** `What is our total pipeline?`  
**Expected:** Shows total ₹ value of all Open deals, weighted pipeline, deal count.  
**Pass criteria:** Numbers are non-zero, weighted ≤ total pipeline.

### 2. Pipeline by Sector
**Question:** `How is the Mining sector pipeline looking?`  
**Expected:** Shows pipeline breakdown for Mining sector specifically.  
**Pass criteria:** Only Mining deals are included. Count matches manually counted Mining+Open deals.

### 3. Current-Quarter Pipeline
**Question:** `How many deals are expected to close this quarter?`  
**Expected:** Shows deals with tentative close dates in the current calendar quarter.  
**Pass criteria:** States the quarter label (e.g., "Q3 2026"). Data quality note about missing close dates.

### 4. Weighted Pipeline
**Question:** `What is our weighted pipeline?`  
**Expected:** Shows weighted value (deal value × probability).  
**Pass criteria:** Response mentions how many deals were excluded due to missing probability. Weighted ≤ total.

### 5. Missing Probability Handling
**Question:** `What is our weighted pipeline?`  
**Expected:** Data quality warning: "X deals have no closure probability — excluded from weighted pipeline calculations."  
**Pass criteria:** Warning is present and count is accurate.

### 6. Missing Dates Handling
**Question:** `How many deals are expected to close this quarter?`  
**Expected:** Data quality note about deals with no close date.  
**Pass criteria:** Warning mentions missing close dates if any exist.

### 7. Sector Normalization
**Question:** `Compare Energy and Powerline`  
**Expected:** Returns comparison even if sectors use different capitalizations in Monday.  
**Pass criteria:** Both sectors are identified. Normalized names used.

### 8. Customer Analysis
**Question:** `Which customers have the largest open opportunities?`  
**Expected:** Ranked list of customers by open deal value.  
**Pass criteria:** Customer codes displayed, values present, sorted descending.

### 9. Delayed Work Orders
**Question:** `How many work orders are delayed?`  
**Expected:** Count of work orders past probable end date and not completed.  
**Pass criteria:** Shows count, percentage, and sample delayed items.

### 10. Cross-Board Customer Analysis
**Question:** `Which customers have both active deals and ongoing work orders?`  
**Expected:** Customers that appear in both Deals and Work Orders boards.  
**Pass criteria:** Only "both" relationship customers shown. Name matching noted.

### 11. Ambiguous Question
**Question:** `How are we doing?`  
**Expected:** Agent asks a clarifying question: "Would you like to see the sales pipeline, work order execution, or a full leadership update?"  
**Pass criteria:** Response is a question, not an answer. No data returned.

### 12. Leadership Update
**Question:** `Prepare a leadership update`  
**Expected:** Structured executive brief with pipeline, revenue, operations, sectors, risks.  
**Pass criteria:** Contains multiple sections. Data quality warnings present.

### 13. Monday API Failure
**Test:** Set `MONDAY_API_TOKEN=invalid_token` in `.env`, restart backend, ask a question.  
**Expected:** Friendly error: "I couldn't retrieve data from Monday.com right now. Please check your API token."  
**Pass criteria:** No stack trace exposed. No app crash.

### 14. Win Rate / Revenue
**Question:** `What is our win rate and revenue from won deals?`  
**Expected:** Win rate percentage, won deal count, total won value.  
**Pass criteria:** Win rate = won / (won + lost). Values present.

### 15. Sector Performance Comparison
**Question:** `Compare Mining and Renewables`  
**Expected:** Side-by-side sector stats.  
**Pass criteria:** Both sectors present, pipeline values, deal counts, WO counts shown.

---

## Health Check
- Open `http://localhost:3001/api/health` in browser.  
- Expected: `{"status":"ok","monday":"connected","timestamp":"..."}`

---

## Performance Notes
- First query per session will be slower (~3-5 seconds) due to Monday API fetch + LLM call.
- Subsequent queries within 5 minutes use cache and respond in ~1-2 seconds.
