import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fetchMultipleStockPrices } from '@/lib/stockApi';

export async function GET(request: NextRequest) {
  try {
    const playerId = request.nextUrl.searchParams.get('playerId');

    // If playerId provided, return that player's portfolio
    // Otherwise, return all players' portfolios
    if (playerId) {
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

      // Get all symbols from positions
      const allSymbols = positionSummaries.map(p => p.symbol);

      // Fetch current prices
      const prices = allSymbols.length > 0
        ? await fetchMultipleStockPrices(allSymbols)
        : {};

      // Update cached prices
      for (const [symbol, price] of Object.entries(prices)) {
        await db.saveStockPrice(symbol, price);
      }

      // Calculate portfolio values
      const cashBalance = playerSummary?.cashBalance ?? 0;
      const totalDeposited = playerSummary?.totalDeposited ?? 0;
      const totalRealizedPnL = playerSummary?.totalRealizedPnL ?? 0;

      // Calculate position values and unrealized P&L
      let totalPositionValue = 0;
      let totalUnrealizedPnL = 0;

      const stockDetails = positionSummaries.map(pos => {
        const currentPrice = prices[pos.symbol] || 0;
        const currentValue = pos.quantity * currentPrice;
        const unrealizedPnL = currentValue - pos.totalCostBasis;
        const unrealizedPnLPercent = pos.totalCostBasis > 0
          ? (unrealizedPnL / pos.totalCostBasis) * 100
          : 0;

        totalPositionValue += currentValue;
        totalUnrealizedPnL += unrealizedPnL;

        return {
          symbol: pos.symbol,
          quantity: pos.quantity,
          averageCostBasis: pos.averageCostBasis,
          totalCostBasis: pos.totalCostBasis,
          currentPrice,
          currentValue,
          unrealizedPnL,
          unrealizedPnLPercent,
          firstPurchaseDate: pos.firstPurchaseDate,
          lastActivityDate: pos.lastActivityDate,
          // For backwards compatibility
          gainLoss: unrealizedPnL,
          gainLossPercent: unrealizedPnLPercent,
          purchasePrice: pos.averageCostBasis,
        };
      });

      // Calculate totals
      const totalValue = cashBalance + totalPositionValue;
      const totalPnL = totalRealizedPnL + totalUnrealizedPnL;
      const totalPnLPercent = totalDeposited > 0
        ? (totalPnL / totalDeposited) * 100
        : 0;

      // Get yesterday's snapshot for today's change calculation
      const snapshots = await db.getPlayerSnapshots(playerId);
      const today = new Date().toISOString().split('T')[0];

      // Find the most recent snapshot that's not today
      const previousSnapshots = snapshots
        .filter(s => s.date < today)
        .sort((a, b) => b.date.localeCompare(a.date));
      const yesterdaySnapshot = previousSnapshots[0];

      // Calculate today's change
      const previousValue = yesterdaySnapshot?.totalValue ?? totalDeposited;
      const todayChange = totalValue - previousValue;
      const todayChangePercent = previousValue > 0
        ? (todayChange / previousValue) * 100
        : 0;

      // Save daily snapshot
      await db.savePortfolioSnapshot({
        playerId: player.id,
        date: today,
        totalValue,
        totalGainLoss: totalPnL,
        totalGainLossPercent: totalPnLPercent,
      });

      return NextResponse.json({
        player: {
          id: player.id,
          name: player.name,
          cashBalance,
          totalDeposited,
          totalPositionValue,
          totalValue,
          totalRealizedPnL,
          totalUnrealizedPnL,
          totalPnL,
          totalPnLPercent,
          todayChange,
          todayChangePercent,
          // For backwards compatibility
          currentCash: cashBalance,
          startingCash: totalDeposited,
          totalGainLoss: totalPnL,
          totalGainLossPercent: totalPnLPercent,
        },
        positions: stockDetails,
      });
    } else {
      // Return all players' portfolios
      const players = await db.getPlayers();
      const allPlayerSummaries = await db.getPlayerSummaries();
      const allPositionSummaries = await db.getPositionSummaries();

      // Get all unique symbols
      const allSymbols = Array.from(new Set(allPositionSummaries.map(p => p.symbol)));

      // Fetch all stock prices
      const prices = allSymbols.length > 0
        ? await fetchMultipleStockPrices(allSymbols)
        : {};
      for (const [symbol, price] of Object.entries(prices)) {
        await db.saveStockPrice(symbol, price);
      }

      const portfolios = await Promise.all(players.map(async (player) => {
        const playerSummary = allPlayerSummaries.find(s => s.playerId === player.id);
        const positions = allPositionSummaries.filter(p => p.playerId === player.id);

        const cashBalance = playerSummary?.cashBalance ?? 0;
        const totalDeposited = playerSummary?.totalDeposited ?? 0;
        const totalRealizedPnL = playerSummary?.totalRealizedPnL ?? 0;

        let totalPositionValue = 0;
        let totalUnrealizedPnL = 0;

        const stockDetails = positions.map(pos => {
          const currentPrice = prices[pos.symbol] || 0;
          const currentValue = pos.quantity * currentPrice;
          const unrealizedPnL = currentValue - pos.totalCostBasis;
          const unrealizedPnLPercent = pos.totalCostBasis > 0
            ? (unrealizedPnL / pos.totalCostBasis) * 100
            : 0;

          totalPositionValue += currentValue;
          totalUnrealizedPnL += unrealizedPnL;

          return {
            symbol: pos.symbol,
            quantity: pos.quantity,
            averageCostBasis: pos.averageCostBasis,
            totalCostBasis: pos.totalCostBasis,
            currentPrice,
            currentValue,
            unrealizedPnL,
            unrealizedPnLPercent,
            firstPurchaseDate: pos.firstPurchaseDate,
            lastActivityDate: pos.lastActivityDate,
            // For backwards compatibility
            gainLoss: unrealizedPnL,
            gainLossPercent: unrealizedPnLPercent,
            purchasePrice: pos.averageCostBasis,
          };
        });

        const totalValue = cashBalance + totalPositionValue;
        const totalPnL = totalRealizedPnL + totalUnrealizedPnL;
        const totalPnLPercent = totalDeposited > 0
          ? (totalPnL / totalDeposited) * 100
          : 0;

        // Get yesterday's snapshot for today's change calculation
        const playerSnapshots = await db.getPlayerSnapshots(player.id);
        const today = new Date().toISOString().split('T')[0];

        const previousSnapshots = playerSnapshots
          .filter(s => s.date < today)
          .sort((a, b) => b.date.localeCompare(a.date));
        const yesterdaySnapshot = previousSnapshots[0];

        const previousValue = yesterdaySnapshot?.totalValue ?? totalDeposited;
        const todayChange = totalValue - previousValue;
        const todayChangePercent = previousValue > 0
          ? (todayChange / previousValue) * 100
          : 0;

        // Save daily snapshot
        await db.savePortfolioSnapshot({
          playerId: player.id,
          date: today,
          totalValue,
          totalGainLoss: totalPnL,
          totalGainLossPercent: totalPnLPercent,
        });

        return {
          player: {
            id: player.id,
            name: player.name,
            cashBalance,
            totalDeposited,
            totalPositionValue,
            totalValue,
            totalRealizedPnL,
            totalUnrealizedPnL,
            totalPnL,
            totalPnLPercent,
            todayChange,
            todayChangePercent,
            // For backwards compatibility
            currentCash: cashBalance,
            startingCash: totalDeposited,
            totalGainLoss: totalPnL,
            totalGainLossPercent: totalPnLPercent,
          },
          positions: stockDetails,
        };
      }));

      return NextResponse.json({ portfolios });
    }
  } catch (error) {
    console.error('Portfolio error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
