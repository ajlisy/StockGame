import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fetchHistoricalPricesWithDates, fetchMultipleStockPrices, normalizeDate } from '@/lib/stockApi';

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

    // Get ledger-based summaries
    const playerSummary = await db.getPlayerSummary(playerId);
    const positionSummaries = await db.getPlayerPositionSummaries(playerId);

    const cashBalance = playerSummary?.cashBalance ?? 0;
    const totalDeposited = playerSummary?.totalDeposited ?? 0;

    if (positionSummaries.length === 0) {
      // No positions, return empty or just cash value
      return NextResponse.json({
        snapshots: [{
          date: new Date().toISOString().split('T')[0],
          totalValue: cashBalance,
          totalGainLoss: cashBalance - totalDeposited,
          totalGainLossPercent: totalDeposited > 0 ? ((cashBalance - totalDeposited) / totalDeposited) * 100 : 0,
        }]
      });
    }

    // Find the earliest purchase date - normalize all dates to ISO format
    const purchaseDates = positionSummaries
      .map(p => p.firstPurchaseDate ? normalizeDate(p.firstPurchaseDate) : null)
      .filter((d): d is string => d !== null);

    const earliestDate = purchaseDates.length > 0
      ? purchaseDates.sort()[0]
      : new Date().toISOString().split('T')[0];

    console.log(`[Portfolio History] Earliest date: ${earliestDate}, positions: ${positionSummaries.length}`);

    // Get unique symbols
    const symbols = Array.from(new Set(positionSummaries.map(p => p.symbol)));

    // Fetch historical prices for all symbols from the earliest date
    const historicalPrices: Record<string, Record<string, number>> = {};

    for (const symbol of symbols) {
      const history = await fetchHistoricalPricesWithDates(symbol, earliestDate);
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

    console.log(`[Portfolio History] Date range: ${sortedDates[0]} to ${sortedDates[sortedDates.length - 1]}, total days: ${sortedDates.length}`);

    // Calculate portfolio value for each date
    const snapshots: DailySnapshot[] = [];
    let lastKnownPrices: Record<string, number> = {};

    for (const date of sortedDates) {
      let stockValue = 0;

      for (const position of positionSummaries) {
        // Normalize position date for comparison
        const positionDate = position.firstPurchaseDate
          ? normalizeDate(position.firstPurchaseDate)
          : earliestDate;

        // Only include positions that existed on this date
        if (date >= positionDate) {
          // Get price for this date, or use last known price
          let price = historicalPrices[position.symbol]?.[date];
          if (price !== undefined) {
            lastKnownPrices[position.symbol] = price;
          } else {
            price = lastKnownPrices[position.symbol] || position.averageCostBasis;
          }
          stockValue += position.quantity * price;
        }
      }

      const totalValue = stockValue + cashBalance;
      const totalGainLoss = totalValue - totalDeposited;
      const totalGainLossPercent = totalDeposited > 0
        ? (totalGainLoss / totalDeposited) * 100
        : 0;

      snapshots.push({
        date,
        totalValue,
        totalGainLoss,
        totalGainLossPercent,
      });
    }

    // Check if today is already in the snapshots
    const today = new Date().toISOString().split('T')[0];
    const hasTodayData = snapshots.some(s => s.date === today);

    // If today's data is missing, fetch current prices and add it
    if (!hasTodayData) {
      const currentPrices = await fetchMultipleStockPrices(symbols);
      let todayStockValue = 0;

      for (const position of positionSummaries) {
        const price = currentPrices[position.symbol] || lastKnownPrices[position.symbol] || position.averageCostBasis;
        todayStockValue += position.quantity * price;
      }

      const todayTotalValue = todayStockValue + cashBalance;
      const todayGainLoss = todayTotalValue - totalDeposited;
      const todayGainLossPercent = totalDeposited > 0
        ? (todayGainLoss / totalDeposited) * 100
        : 0;

      snapshots.push({
        date: today,
        totalValue: todayTotalValue,
        totalGainLoss: todayGainLoss,
        totalGainLossPercent: todayGainLossPercent,
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
