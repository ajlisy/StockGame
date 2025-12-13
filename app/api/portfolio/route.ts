import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fetchMultipleStockPrices, fetchHistoricalPrices } from '@/lib/stockApi';

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

      const positions = await db.getPlayerPositions(playerId);
      const initialPositions = await db.getPlayerInitialPositions(playerId);

      // Get all symbols from both current and initial positions
      const allSymbols = Array.from(new Set([
        ...positions.map(p => p.symbol),
        ...initialPositions.map(p => p.symbol)
      ]));

      // Fetch current prices
      const prices = await fetchMultipleStockPrices(allSymbols);

      // Update cached prices
      for (const [symbol, price] of Object.entries(prices)) {
        await db.saveStockPrice(symbol, price);
      }

      // Calculate portfolio value based on INITIAL positions for P&L
      let totalValue = player.currentCash || 0;
      let initialTotalValue = 0;

      // Calculate current value and P&L based on initial positions
      const stockDetails = initialPositions.map(initialPos => {
        const currentPrice = prices[initialPos.symbol] || initialPos.purchasePrice || 0;
        const costBasis = initialPos.quantity * initialPos.purchasePrice;
        const currentValue = initialPos.quantity * currentPrice;
        const gainLoss = currentValue - costBasis;
        const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;

        initialTotalValue += costBasis;

        // Find current position (may be different from initial)
        const currentPos = positions.find(p => p.symbol === initialPos.symbol);

        return {
          symbol: initialPos.symbol,
          quantity: currentPos?.quantity || 0, // Current quantity held
          initialQuantity: initialPos.quantity, // Initial quantity from CSV
          purchasePrice: initialPos.purchasePrice,
          currentPrice: currentPrice || 0,
          costBasis,
          currentValue,
          gainLoss,
          gainLossPercent,
        };
      });

      // Add current cash to total value
      totalValue = player.currentCash || 0;
      // Add current value of initial positions
      stockDetails.forEach(stock => {
        totalValue += stock.currentValue;
      });

      // P&L is total portfolio value minus starting cash ($100,000)
      // Default to $100,000 starting cash if not set
      const startingCash = player.startingCash || 100000;
      const totalGainLoss = totalValue - startingCash;
      const totalGainLossPercent = startingCash > 0
        ? ((totalValue - startingCash) / startingCash) * 100
        : 0;

      // Save daily snapshot
      const today = new Date().toISOString().split('T')[0];
      await db.savePortfolioSnapshot({
        playerId: player.id,
        date: today,
        totalValue,
        totalGainLoss,
        totalGainLossPercent,
      });

      return NextResponse.json({
        player: {
          id: player.id,
          name: player.name,
          startingCash: startingCash,
          currentCash: player.currentCash || 0,
          totalValue: totalValue || 0,
          totalGainLoss: totalGainLoss || 0,
          totalGainLossPercent: totalGainLossPercent || 0,
        },
        positions: stockDetails,
      });
    } else {
      // Return all players' portfolios
      const players = await db.getPlayers();
      const allPositions = await db.getPositions();
      const allInitialPositions = await db.getInitialPositions();

      const allSymbols = Array.from(new Set([
        ...allPositions.map(p => p.symbol),
        ...allInitialPositions.map(p => p.symbol)
      ]));

      // Fetch all stock prices
      const prices = await fetchMultipleStockPrices(allSymbols);
      for (const [symbol, price] of Object.entries(prices)) {
        await db.saveStockPrice(symbol, price);
      }

      const portfolios = await Promise.all(players.map(async (player) => {
        const positions = allPositions.filter(p => p.playerId === player.id);
        const initialPositions = allInitialPositions.filter(p => p.playerId === player.id);

        let totalValue = player.currentCash || 0;
        let initialTotalValue = 0;

        // Calculate based on initial positions
        const stockDetails = initialPositions.map(initialPos => {
          const currentPrice = prices[initialPos.symbol] || initialPos.purchasePrice || 0;
          const costBasis = initialPos.quantity * initialPos.purchasePrice;
          const currentValue = initialPos.quantity * currentPrice;
          const gainLoss = currentValue - costBasis;
          const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;

          initialTotalValue += costBasis;

          // Find current position
          const currentPos = positions.find(p => p.symbol === initialPos.symbol);

          totalValue += currentValue;

          return {
            symbol: initialPos.symbol,
            quantity: currentPos?.quantity || 0,
            initialQuantity: initialPos.quantity,
            purchasePrice: initialPos.purchasePrice,
            currentPrice: currentPrice || 0,
            costBasis,
            currentValue,
            gainLoss,
            gainLossPercent,
          };
        });

        // P&L is total portfolio value minus starting cash ($100,000)
        // Default to $100,000 starting cash if not set
        const startingCash = player.startingCash || 100000;
        const totalGainLoss = totalValue - startingCash;
        const totalGainLossPercent = startingCash > 0
          ? ((totalValue - startingCash) / startingCash) * 100
          : 0;

        // Save daily snapshot
        const today = new Date().toISOString().split('T')[0];
        await db.savePortfolioSnapshot({
          playerId: player.id,
          date: today,
          totalValue,
          totalGainLoss,
          totalGainLossPercent,
        });

        return {
        player: {
          id: player.id,
          name: player.name,
          startingCash: startingCash,
          currentCash: player.currentCash || 0,
          totalValue: totalValue || 0,
          totalGainLoss: totalGainLoss || 0,
          totalGainLossPercent: totalGainLossPercent || 0,
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

