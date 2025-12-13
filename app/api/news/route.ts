import { NextRequest, NextResponse } from 'next/server';
import { fetchHistoricalPrices } from '@/lib/stockApi';

interface PortfolioPosition {
  symbol: string;
  quantity: number;
  purchasePrice: number;
  currentPrice: number;
  costBasis: number;
  currentValue: number;
  gainLoss: number;
  gainLossPercent: number;
}

interface Portfolio {
  player: {
    id: string;
    name: string;
    totalValue: number;
    totalGainLoss: number;
    totalGainLossPercent: number;
    startingCash: number;
    currentCash: number;
  };
  positions: PortfolioPosition[];
}

interface HistoricalPrice {
  date: string;
  price: number;
}

export async function POST(request: NextRequest) {
  try {
    const { portfolio } = await request.json() as { portfolio: Portfolio };

    if (!portfolio || !portfolio.positions || portfolio.positions.length === 0) {
      return NextResponse.json({
        summary: '',
        bullets: [],
      });
    }

    // Fetch historical prices for all positions
    const historicalData: Record<string, HistoricalPrice[]> = {};
    for (const position of portfolio.positions) {
      const history = await fetchHistoricalPrices(position.symbol, 5);
      historicalData[position.symbol] = history;
    }

    // Generate news summary and bullets
    const { summary, bullets } = generateNews(portfolio, historicalData);

    return NextResponse.json({ summary, bullets });
  } catch (error) {
    console.error('News generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate news' },
      { status: 500 }
    );
  }
}

function generateNews(
  portfolio: Portfolio,
  historicalData: Record<string, HistoricalPrice[]>
): { summary: string; bullets: string[] } {
  const bullets: string[] = [];
  const { player, positions } = portfolio;

  // Calculate overall portfolio performance
  const isPositive = player.totalGainLoss >= 0;
  const performanceWord = isPositive ? 'up' : 'down';
  const gainLossAbs = Math.abs(player.totalGainLoss);
  const percentAbs = Math.abs(player.totalGainLossPercent);

  // Generate summary
  let summary = `${player.name}'s portfolio is ${performanceWord} $${gainLossAbs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${percentAbs.toFixed(2)}%) from the $100k starting position.`;

  // Analyze each position for bullets
  for (const position of positions) {
    const history = historicalData[position.symbol] || [];

    if (history.length >= 2) {
      // Calculate daily change (most recent vs second most recent)
      const latestPrice = history[history.length - 1]?.price || position.currentPrice;
      const previousPrice = history[history.length - 2]?.price || latestPrice;
      const dailyChange = latestPrice - previousPrice;
      const dailyChangePercent = previousPrice > 0 ? (dailyChange / previousPrice) * 100 : 0;

      if (Math.abs(dailyChangePercent) >= 0.5) {
        const direction = dailyChange >= 0 ? 'gained' : 'lost';
        bullets.push(
          `${position.symbol} ${direction} ${Math.abs(dailyChangePercent).toFixed(2)}% today, ${dailyChange >= 0 ? 'adding' : 'reducing'} $${Math.abs(dailyChange * position.quantity).toFixed(2)} to the position.`
        );
      }
    }

    // Multi-day trend analysis
    if (history.length >= 4) {
      const fourDaysAgo = history[0]?.price;
      const now = history[history.length - 1]?.price || position.currentPrice;

      if (fourDaysAgo && now) {
        const weekChange = now - fourDaysAgo;
        const weekChangePercent = (weekChange / fourDaysAgo) * 100;

        if (Math.abs(weekChangePercent) >= 2) {
          const trend = weekChange >= 0 ? 'rallied' : 'declined';
          bullets.push(
            `${position.symbol} has ${trend} ${Math.abs(weekChangePercent).toFixed(2)}% over the past 4 trading days.`
          );
        }
      }
    }

    // Position-specific performance
    if (Math.abs(position.gainLossPercent) >= 5) {
      const status = position.gainLoss >= 0 ? 'profit' : 'loss';
      bullets.push(
        `${position.symbol} holding shows a ${Math.abs(position.gainLossPercent).toFixed(2)}% ${status} since purchase.`
      );
    }
  }

  // Add cash position note if significant
  const cashPercent = (player.currentCash / player.totalValue) * 100;
  if (cashPercent >= 20) {
    bullets.push(
      `${cashPercent.toFixed(0)}% of portfolio is in cash, available for new positions.`
    );
  }

  // Limit to 4 bullets
  const limitedBullets = bullets.slice(0, 4);

  // If no bullets generated, add a generic one
  if (limitedBullets.length === 0) {
    limitedBullets.push(
      `Portfolio holds ${positions.length} position${positions.length !== 1 ? 's' : ''} with ${isPositive ? 'positive' : 'negative'} overall returns.`
    );
  }

  return { summary, bullets: limitedBullets };
}
