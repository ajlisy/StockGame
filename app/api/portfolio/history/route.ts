import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fetchHistoricalPricesWithDates } from '@/lib/stockApi';

interface DailySnapshot {
  date: string;
  totalValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
}

export async function GET(request: NextRequest) {
  try {
    const playerId = request.nextUrl.searchParams.get('playerId');

    if (!playerId) {
      return NextResponse.json(
        { error: 'Player ID is required' },
        { status: 400 }
      );
    }

    // Get player info
    const player = await db.getPlayer(playerId);
    if (!player) {
      return NextResponse.json(
        { error: 'Player not found' },
        { status: 404 }
      );
    }

    // Get player's positions
    const positions = await db.getPlayerPositions(playerId);

    if (positions.length === 0) {
      // No positions, return empty or just starting value
      return NextResponse.json({
        snapshots: [{
          date: new Date().toISOString().split('T')[0],
          totalValue: player.currentCash,
          totalGainLoss: player.currentCash - player.startingCash,
          totalGainLossPercent: ((player.currentCash - player.startingCash) / player.startingCash) * 100,
        }]
      });
    }

    // Find the earliest purchase date
    const purchaseDates = positions.map(p => p.purchaseDate).filter(Boolean);
    const earliestDate = purchaseDates.length > 0
      ? purchaseDates.sort()[0]
      : new Date().toISOString().split('T')[0];

    // Get unique symbols
    const symbols = Array.from(new Set(positions.map(p => p.symbol)));

    // Fetch historical prices for all symbols (1 month range to cover most cases)
    const historicalPrices: Record<string, Record<string, number>> = {};

    for (const symbol of symbols) {
      const history = await fetchHistoricalPricesWithDates(symbol, '1mo');
      historicalPrices[symbol] = {};
      for (const h of history) {
        historicalPrices[symbol][h.date] = h.price;
      }
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Get all unique dates from the historical data
    const allDates = new Set<string>();
    for (const symbol of symbols) {
      Object.keys(historicalPrices[symbol] || {}).forEach(date => allDates.add(date));
    }

    // Filter dates to only include those on or after the earliest purchase date
    const sortedDates = Array.from(allDates)
      .filter(date => date >= earliestDate)
      .sort();

    // Calculate portfolio value for each date
    const snapshots: DailySnapshot[] = [];
    let lastKnownPrices: Record<string, number> = {};

    for (const date of sortedDates) {
      let stockValue = 0;

      for (const position of positions) {
        // Only include positions that existed on this date
        const positionDate = position.purchaseDate || earliestDate;
        if (date >= positionDate) {
          // Get price for this date, or use last known price
          let price = historicalPrices[position.symbol]?.[date];
          if (price !== undefined) {
            lastKnownPrices[position.symbol] = price;
          } else {
            price = lastKnownPrices[position.symbol] || position.purchasePrice;
          }
          stockValue += position.quantity * price;
        }
      }

      const totalValue = stockValue + player.currentCash;
      const totalGainLoss = totalValue - player.startingCash;
      const totalGainLossPercent = player.startingCash !== 0
        ? (totalGainLoss / player.startingCash) * 100
        : 0;

      snapshots.push({
        date,
        totalValue,
        totalGainLoss,
        totalGainLossPercent,
      });
    }

    return NextResponse.json({ snapshots });
  } catch (error) {
    console.error('Portfolio history error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
