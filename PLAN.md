# Stock Trading Competition Website - Implementation Plan

## Technology Stack
- **Frontend**: Next.js 14 (React) with TypeScript
- **Styling**: Tailwind CSS for modern, responsive design
- **Backend**: Next.js API Routes (serverless functions)
- **Database**: JSON file-based storage (simple, no external DB needed initially) OR DynamoDB if needed
- **Stock Data**: Alpha Vantage API (free tier) or Yahoo Finance API
- **Deployment**: AWS Amplify

## Project Structure
```
StockGame/
├── app/                    # Next.js 14 app directory
│   ├── page.tsx           # Front page (dashboard)
│   ├── login/             # Login page
│   ├── portfolio/         # Individual portfolio view
│   ├── trade/             # Trading interface
│   └── api/               # API routes
│       ├── auth/          # Authentication endpoints
│       ├── trades/        # Trading endpoints
│       ├── portfolio/     # Portfolio data endpoints
│       └── upload/        # CSV upload endpoint
├── lib/                   # Utility functions
│   ├── db.ts             # Database operations
│   ├── stockApi.ts       # Stock price fetching
│   └── validation.ts    # Trade validation
├── components/            # React components
│   ├── PortfolioCard.tsx
│   ├── StockTable.tsx
│   ├── TradeForm.tsx
│   └── Leaderboard.tsx
├── data/                  # JSON database (or DynamoDB)
└── public/                # Static assets
```

## Features to Implement

### 1. Front Page Dashboard
- Side-by-side comparison of both players
- Total P&L (large, prominent display)
- Portfolio value breakdown
- Performance by stock
- Leaderboard indicator (who's ahead)
- Last updated timestamp

### 2. Authentication System
- Simple password-based login
- Session management
- Protected routes for trading

### 3. Trading System
- Buy/Sell interface
- Real-time cash balance check
- Validation: Can't exceed available cash
- Rule: Must sell current stock before buying different one
- Transaction history

### 4. CSV Upload
- Admin interface to upload initial positions
- Parse CSV with columns: Player, Symbol, Quantity, Purchase Price, Date
- Initialize player accounts and positions

### 5. Stock Price Integration
- Fetch current/latest stock prices
- Cache prices to avoid rate limits
- Update prices periodically

### 6. Portfolio Display
- Current holdings
- Cost basis vs current value
- Gain/loss per stock
- Total portfolio value

## Assumptions (to be confirmed)
- CSV format: Player, Symbol, Quantity, PurchasePrice, Date
- Starting cash: Calculated from initial positions or set manually
- Trading rule: Must sell all shares of current stock before buying different stock
- Stock API: Alpha Vantage (free tier: 5 calls/min, 500 calls/day)
- Passwords: Set by admin initially, players can change

## Deployment Steps
1. Initialize Next.js project
2. Set up AWS Amplify configuration
3. Configure environment variables
4. Deploy to Amplify

