# 📦 Singh Dispatch Saathi

Mobile-first warehouse dispatch PWA for Singh Associates. Reads SAP invoice PDFs, matches each line to a physical shelf location from a Google Sheets stock master, and lets dispatchers confirm with one tap. All UI in Hinglish.

---

## 🚀 Quick Start

```bash
# 1. Install
npm install

# 2. Configure (see Google Sheets Setup below)
cp .env.example .env.local
# Edit .env.local with your sheet ID + service account key

# 3. Run
npm run dev
# → http://localhost:3000
```

---

## 📋 Google Sheets Setup

### Step 1 — Create the Sheet

Create a new Google Sheet (any name, e.g. **SDS_Master**). Add these 5 tabs:

#### Tab 1: `STOCK_MASTER` (read by app)
Headers in row 1:

| A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| Material Code | Brand | Technical | Packing | Batch | Qty | Cases | Storage | Locations |

- **Storage** = `FGST` (saleable) or `FGNS` (blocked — app never suggests these)
- **Locations** = comma-separated like `A1,I3` or single `C4`
- Refresh manually by paste from your STK_DD_MM_YYYY.xlsx export

#### Tab 2: `DISPATCH_HISTORY` (written by app)
Headers:
`Pick_ID | Invoice_No | Party | Date | Brand | Pack | Batch | Qty | Cases | Expected_Loc | Actual_Loc | User | Timestamp`

#### Tab 3: `NOT_FOUND_LOG` (written by app)
Headers:
`Pick_ID | Invoice_No | Party | Date | Brand | Pack | Batch | Qty | Expected_Loc | Reason | User | Timestamp | Status`

#### Tab 4: `LOCATION_CORRECTION_LOG` (written by app + supervisor)
Headers:
`Log_ID | Brand | Pack | Batch | Expected_Loc | Actual_Loc | Dispatcher | Timestamp | Status | Supervisor | Review_Date | Notes`

#### Tab 5: `ANALYTICS` (optional, formulas only)
Drop in:
```
="Total Found: "&COUNTA(DISPATCH_HISTORY!A2:A)
="Total Not Found: "&COUNTA(NOT_FOUND_LOG!A2:A)
="Pending Corrections: "&COUNTIF(LOCATION_CORRECTION_LOG!I:I,"PENDING")
```
And for top missing locations:
```
=QUERY(NOT_FOUND_LOG!A:M, "select I, count(A) where I is not null group by I order by count(A) desc limit 10")
```

### Step 2 — Service Account

1. Go to https://console.cloud.google.com → create or select a project
2. Enable **Google Sheets API**
3. Create a Service Account → download the JSON key
4. From the JSON, copy `client_email` → set as `GOOGLE_SERVICE_ACCOUNT_EMAIL`
5. Copy `private_key` (the multi-line string with `\n`) → set as `GOOGLE_PRIVATE_KEY`
6. Open your Google Sheet → Share → paste the service account email → give **Editor** access

### Step 3 — Fill `.env.local`

```env
GOOGLE_SHEET_ID=1aBcDeFgHiJkLmNoPqRsTuVwXyZ                  # from sheet URL
GOOGLE_SERVICE_ACCOUNT_EMAIL=sds@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n"
```

---

## 🏗️ Architecture

```
PDF Upload (client)
    ↓ pdf.js extracts text
    ↓ POST /api/parse-pdf
Server:
    ↓ split on "TAX INVOICE" markers → dedupe by Invoice No
    ↓ extract line items (handles brand-wrap, pack-wrap, multi-line continuations)
    ↓ read STOCK_MASTER from Google Sheets
    ↓ 4-tier match: EXACT → ALIAS → BRAND_PACK → MANUAL
    ↓ return pickList with location + confidence
Client:
    ↓ render PickCard per item
    ↓ Dispatcher taps MAAL MIL GAYA / MAAL NAHI MILA
    ↓ POST /api/sheets → append to history sheets
    ↓ If actual ≠ expected location → ask "HAAN/NAHI" → log correction
Supervisor route:
    ↓ Approve/Reject pending location corrections
    ↓ Review Not Found logs
```

---

## 📁 Folder Structure

```
src/
  app/
    layout.tsx              Root layout, PWA manifest, SW registration
    page.tsx                Home: name + Upload/Paste/Resume buttons
    globals.css             Tailwind + custom button styles
    pick-list/page.tsx      Pick list with invoice filter + counters
    supervisor/page.tsx     Two tabs: corrections + not-found logs
    api/
      parse-pdf/route.ts    POST: text → pickList
      sheets/route.ts       POST: FOUND / NOT_FOUND / APPROVE / REJECT
  components/
    PickCard.tsx            Single item card: location pill, FOUND/NOT FOUND
  lib/
    pdf-parser.ts           SAP PDF text → ParsedInvoice[]
    matcher.ts              Normalization + 4-tier matching
    sheets.ts               Google Sheets API wrapper
  types/index.ts            All interfaces
public/
  manifest.json             PWA manifest
  sw.js                     Service worker (caches shell, skips /api/)
  icon.svg / icon-192.png / icon-512.png
```

---

## 🌐 Deployment

### Vercel (recommended — 1 click)
```bash
npm i -g vercel
vercel
# Set env vars in Vercel dashboard
```

### Self-hosted
```bash
npm run build
npm start
# Defaults to port 3000
```

### Install as PWA on Android phones
1. Open the deployed URL in Chrome
2. Tap ⋮ → **Add to Home Screen**
3. App now opens fullscreen like a native app

---

## 🧪 Tested Against

- **Smith N Smith SAP invoices**: 4 invoices, 12 line items → **11/12 correctly matched** (PATTON, HALOSMITH, SHERDIL GR alias, NOVA GOLD alias ×3, TREKKER ×3, VOLT SMITH brand-wrap). The 2 HITLER lines correctly fall to MANUAL because the only available stock for that pack is `FGNS` (non-saleable).
- **Stock master**: 468 SKUs across FGST + FGNS storage states.

---

## 🔑 Brand Aliases

Hardcoded in `src/lib/matcher.ts`:
- `NOVAGOLD` → `NOVA GOLD`
- `SHERDILGR` → `SHERDIL GR`

To add more, edit the `BRAND_ALIASES` constant. Future: move to a Google Sheet `MAPPING_OVERRIDES` tab.

---

## 🎯 What's NOT in V1

- WhatsApp Share direct ingestion (future ready — same parser will work on text dump)
- Database (Google Sheets is the only store)
- Dispatcher editing of STOCK_MASTER (read-only by design)
- Auto-applying approved location corrections to STOCK_MASTER (supervisor does this manually after review)
- Charts/dashboards (analytics are static QUERY formulas in the sheet)

---

## 🐛 Known Limitations

- PDF parser tuned for Smith N Smith SAP format. Other principals' SAP templates may need adjustments in `pdf-parser.ts`.
- Service worker caches aggressively. On code updates, bump `CACHE` constant in `public/sw.js`.
- Brand-wrap detection works for two-line brands (VOLT SMITH). Three-line wraps would need extension.
