# Stock Trading Competition Website

A modern, full-featured stock trading competition platform built with Next.js, TypeScript, and Tailwind CSS. Perfect for tracking a friendly stock trading competition between players.

## Features

- 📊 **Real-time Portfolio Tracking**: See current portfolio values, P&L, and performance metrics
- 🏆 **Leaderboard**: Clear indication of who's ahead in the competition
- 📈 **Stock Performance**: Detailed breakdown of how each stock is performing
- 💰 **Secure Trading**: Password-protected trading interface with validation
- 📁 **CSV Import**: Easy upload of initial positions from December 7th
- 🎨 **Modern UI**: Beautiful, responsive design with Tailwind CSS
- ✅ **Trade Validation**: Prevents trades exceeding available cash and enforces single-stock rule

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Next.js API Routes (Serverless)
- **Database**: JSON file-based storage (simple, no external DB needed)
- **Stock Data**: Yahoo Finance API (free, no API key required)
- **Deployment**: AWS Amplify

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- AWS Account (for deployment)

### Local Development

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd StockGame
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create data directory**
   ```bash
   mkdir -p data
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Initial Setup

1. **Upload Initial Positions**
   - Go to `/admin` page
   - Upload a CSV file with the following format:
     ```csv
     Player, Symbol, Quantity, PurchasePrice, Date
     John, AAPL, 10, 150.50, 2024-12-07
     Jane, GOOGL, 8, 140.75, 2024-12-07
     ```
   - New players will be created with default password: `changeme`
   - **Important**: Players should change their passwords after first login

2. **Player Login**
   - Players can login at `/login` using their name and password
   - After login, they can make trades at `/trade` and view their portfolio at `/portfolio`

## CSV Format

The CSV file for initial positions should have the following columns:

- **Player**: Player's name (case-insensitive)
- **Symbol**: Stock ticker symbol (e.g., AAPL, MSFT, GOOGL)
- **Quantity**: Number of shares
- **PurchasePrice**: Price per share at purchase
- **Date**: Purchase date (format: YYYY-MM-DD)

Example:
```csv
Player, Symbol, Quantity, PurchasePrice, Date
John, AAPL, 10, 150.50, 2024-12-07
John, MSFT, 5, 380.25, 2024-12-07
Jane, GOOGL, 8, 140.75, 2024-12-07
```

## Trading Rules

1. **Cash Validation**: Players cannot make trades that exceed their available cash
2. **Single Stock Rule**: Players must sell their current stock before buying a different one
3. **Real-time Prices**: Stock prices are fetched from Yahoo Finance API (latest close or current price)

## Deployment to AWS Amplify

### Option 1: Connect via GitHub

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. **Connect to AWS Amplify**
   - Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify)
   - Click "New app" → "Host web app"
   - Select "GitHub" and authorize
   - Choose your repository and branch
   - Amplify will auto-detect Next.js settings

3. **Configure Build Settings**
   - The `amplify.yml` file is already configured
   - Ensure Node.js version is 18 or higher in build settings

4. **Environment Variables** (Optional)
   - If you want to use Alpha Vantage API instead of Yahoo Finance:
     - Add `ALPHA_VANTAGE_API_KEY` in Amplify environment variables
   - No environment variables are required for Yahoo Finance API

5. **Deploy**
   - Click "Save and deploy"
   - Wait for build to complete
   - Your site will be live!

### Option 2: Deploy via Amplify CLI

1. **Install Amplify CLI**
   ```bash
   npm install -g @aws-amplify/cli
   ```

2. **Initialize Amplify**
   ```bash
   amplify init
   ```

3. **Add Hosting**
   ```bash
   amplify add hosting
   ```

4. **Publish**
   ```bash
   amplify publish
   ```

## Important Notes

### Data Storage

- The app uses JSON file-based storage
- **Important for AWS Amplify**: In serverless environments, file storage is ephemeral
- For production persistence, consider migrating to:
  - **DynamoDB** (recommended for AWS)
  - **PostgreSQL** (via AWS RDS or external service)
  - **Supabase** or **PlanetScale** (external managed databases)
- For local development, data is stored in the `data/` directory
- In serverless (AWS Lambda), data is stored in `/tmp/data` (ephemeral)

### Security

- Default passwords are set to "changeme" for new players
- In production, implement proper password change functionality
- Consider adding rate limiting for API endpoints
- Use environment variables for sensitive data

### Stock Price Updates

- Stock prices are fetched from Yahoo Finance API (free, no API key)
- Prices are cached to reduce API calls
- Prices update every 30 seconds on the dashboard
- Alternative: Use Alpha Vantage API (requires free API key)

### File Permissions (for local development)

On Unix-based systems, ensure the data directory is writable:
```bash
chmod 755 data
```

## Project Structure

```
StockGame/
├── app/                    # Next.js app directory
│   ├── page.tsx           # Main dashboard
│   ├── login/             # Login page
│   ├── portfolio/         # Individual portfolio view
│   ├── trade/             # Trading interface
│   ├── admin/             # CSV upload page
│   └── api/               # API routes
│       ├── auth/          # Authentication
│       ├── trades/        # Trading endpoints
│       ├── portfolio/     # Portfolio data
│       ├── upload/        # CSV upload
│       └── stocks/        # Stock price fetching
├── components/            # React components
│   ├── PortfolioCard.tsx
│   ├── StockTable.tsx
│   └── TradeForm.tsx
├── lib/                   # Utility functions
│   ├── db.ts             # Database operations
│   ├── stockApi.ts       # Stock price fetching
│   ├── validation.ts     # Trade validation
│   └── auth.ts           # Authentication
├── data/                  # JSON database files
└── public/                # Static assets
```

## Troubleshooting

### Stock prices not loading
- Check internet connection
- Yahoo Finance API may be rate-limited
- Try using Alpha Vantage API as alternative

### CSV upload fails
- Ensure CSV format matches exactly (case-sensitive column names)
- Check that all required fields are present
- Verify date format is YYYY-MM-DD

### Build errors on Amplify
- Ensure Node.js version is 18+
- Check that all dependencies are in package.json
- Review build logs in Amplify console

## Future Enhancements

- [ ] Password change functionality
- [ ] Transaction history page
- [ ] Email notifications for trades
- [ ] Historical performance charts
- [ ] Multiple stock holdings support
- [ ] Database migration (DynamoDB/PostgreSQL)
- [ ] Real-time updates via WebSockets

## License

This project is for personal/educational use.

## Support

For issues or questions, please open an issue on GitHub.

