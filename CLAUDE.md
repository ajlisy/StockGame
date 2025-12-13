# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Next.js 14 stock trading competition platform for tracking friendly stock trading competitions between players. Players can buy/sell stocks with real-time prices from Yahoo Finance, with portfolio tracking and leaderboard functionality.

## Common Commands

```bash
# Development
npm run dev          # Start development server at localhost:3000
npm run build        # Build production bundle
npm run start        # Start production server
npm run lint         # Run ESLint

# Local setup (first time)
npm install          # Install dependencies
mkdir -p data        # Create data directory for JSON storage
```

## Architecture Overview

### Data Storage Strategy

**Critical**: The app uses JSON file-based storage with environment-aware paths:
- **Local development**: `data/` directory in project root
- **Serverless (AWS Lambda)**: `/tmp/data` (ephemeral - data is lost on Lambda restarts)
- Logic in `lib/db.ts:6-8` switches based on `AWS_LAMBDA_FUNCTION_NAME` env var

Data files stored as JSON:
- `players.json` - player accounts with password hashes (bcrypt), cash balances
- `positions.json` - current stock holdings per player
- `transactions.json` - complete trade history
- `stockPrices.json` - cached stock prices to reduce API calls

### Authentication Flow

**Cookie-based sessions** (not JWT):
- Login via `/api/auth/login/route.ts` sets `playerId` cookie
- Protected routes check `request.cookies.get('playerId')`
- Password hashing with bcryptjs (lib/auth.ts)
- Default password for CSV-imported players: `changeme`

### Trading System Architecture

**Single stock rule enforcement** (lib/validation.ts:33-42):
- Before buying, checks if player owns different stock
- Must sell entire current position before buying different symbol
- Can add to existing position of same symbol (averages cost basis)

**Trade execution flow** (app/api/trades/route.ts):
1. Authenticate via cookie
2. Fetch current price (cached or Yahoo Finance API)
3. Validate trade (cash check, single-stock rule)
4. Update player cash and positions atomically
5. Record transaction in history
6. For buys: updates or creates position with averaged cost basis
7. For sells: reduces quantity or deletes position if selling all shares

### Stock Price Integration

**Yahoo Finance API** (lib/stockApi.ts) - no API key required:
- Endpoint: `query1.finance.yahoo.com/v8/finance/chart/{symbol}`
- Returns `regularMarketPrice` or falls back to `previousClose`
- Historical prices: fetches last 7 days of data for charts and news analysis
- 100ms delay between batch requests to avoid rate limiting
- Prices cached in `stockPrices.json` to minimize API calls
- Alternative: Alpha Vantage API (requires `ALPHA_VANTAGE_API_KEY` env var)

### AI News Analysis

**Claude API Integration** (app/api/news/route.ts):
- Uses Anthropic Claude Sonnet 4 to analyze portfolio performance
- Generates two news sections: "Key Portfolio Drivers This Week" and "Today"
- Analysis includes:
  - Stock-specific price movements (daily and weekly changes)
  - Sector allocation (top 2 sectors from lib/newsApi.ts sector mapping)
  - Portfolio-level P&L trends
- Returns 2-3 actionable bullet points per section
- Falls back to rule-based analysis if `ANTHROPIC_API_KEY` not configured

### CSV Import System

Admin page (`/admin`) allows uploading initial positions:
- Format: `Player, Symbol, Quantity, PurchasePrice, Date`
- **Special symbol `$CASH`**: Use to specify player's cash position (e.g., `John, $CASH, 1, 5000.00, 2024-12-07`)
- Creates new players with default password `changeme`
- Starting cash (`player.startingCash`) = total initial value (all stock positions + cash from CSV)
- Current cash (`player.currentCash`) = cash amount specified with `$CASH` symbol
- P&L is calculated as: `(current stock value + current cash) - startingCash`
- Uses papaparse library for CSV parsing

### App Router Structure

```
app/
├── page.tsx              # Dashboard with all players' portfolios
├── login/page.tsx        # Login form
├── portfolio/page.tsx    # Individual player portfolio view (unused in current setup)
├── trade/page.tsx        # Trading interface (buy/sell)
├── admin/page.tsx        # CSV upload for initial positions
└── api/
    ├── auth/
    │   ├── login/route.ts          # POST: authenticate, set cookie
    │   └── change-password/route.ts # POST: update player password
    ├── trades/route.ts     # POST: execute buy/sell trade
    └── stocks/route.ts     # GET: fetch current prices for symbols
```

## Key Implementation Details

### P&L Calculation

P&L is calculated relative to initial total portfolio value from CSV upload:
- `startingCash` = total initial value (sum of all stock positions + cash from `$CASH` entry)
- `totalValue` = current stock value + current cash
- `totalGainLoss` = totalValue - startingCash
- Portfolio API (app/api/portfolio/route.ts:56-62) defaults startingCash to $100,000 if not set

### Position Cost Basis Averaging

When buying more of an existing position (app/api/trades/route.ts:76-83):
```typescript
totalCost = existingPosition.purchasePrice * existingPosition.quantity + newTotalAmount
totalQuantity = existingPosition.quantity + newQuantity
newAverageCost = totalCost / totalQuantity
```

### Database Singleton Pattern

`lib/db.ts` exports a singleton `db` instance used across all API routes. File operations are synchronous (fs.readFileSync/writeFileSync) - not ideal for production but acceptable for this use case.

### Trade Validation Logic

Three validation checks (lib/validation.ts):
1. **Quantity/price validation**: Must be positive, quantity must be integer
2. **Buy checks**: Sufficient cash + single-stock rule enforcement
3. **Sell checks**: Player owns the stock + sufficient shares

### Environment-Specific Behavior

Code automatically detects AWS Lambda via `process.env.AWS_LAMBDA_FUNCTION_NAME` and switches data directory. No configuration needed.

## Deployment Notes

**AWS Amplify** (configured in amplify.yml):
- Uses Next.js SSR on AWS Lambda
- Data stored in `/tmp` is ephemeral (lost on cold starts)
- For production, migrate to DynamoDB or external database
- No build-time environment variables required for basic functionality

## Technology Stack

- **Next.js 14** (App Router with server components)
- **TypeScript** (strict mode)
- **Tailwind CSS** (utility-first styling, dark mode)
- **Recharts** (stock price charts)
- **Anthropic Claude API** (AI-powered portfolio news analysis)
- **bcryptjs** (password hashing)
- **papaparse** (CSV parsing)
- **Yahoo Finance API** (free stock prices, no auth)

## Environment Variables

Required environment variables in `.env.local`:
- `ANTHROPIC_API_KEY`: API key for Claude AI news analysis (get from https://console.anthropic.com/)

If `ANTHROPIC_API_KEY` is not set, the news API will fall back to simple rule-based analysis.
