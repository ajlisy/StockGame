import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fetchMultipleStockPrices, fetchHistoricalPrices } from '@/lib/stockApi';

export async function GET(request: NextRequest) {
  try {
    const playerId = request.nextUrl.searchParams.get('playerId');
    
    // If playerId provided, return that player's portfolio
    // Otherwise, return all players' portfolios
    if (playerId) {
      const player = db.getPlayer(playerId);
      if (!player) {
        return NextResponse.json(
          { error: 'Player not found' },
          { status: 404 }
        );
      }

      const positions = db.getPlayerPositions(playerId);
      const symbols = positions.map(p => p.symbol);
      
      // Fetch current prices
      const prices = await fetchMultipleStockPrices(symbols);
      
      // Update cached prices
      Object.entries(prices).forEach(([symbol, price]) => {
        db.saveStockPrice(symbol, price);
      });

      // Calculate portfolio value
      let totalValue = player.currentCash || 0;
      let totalCost = 0;
      const stockDetails = positions.map(position => {
        const currentPrice = prices[position.symbol] || position.purchasePrice || 0;
        const currentValue = position.quantity * currentPrice;
        const costBasis = position.quantity * (position.purchasePrice || 0);
        const gainLoss = currentValue - costBasis;
        const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;

        totalValue += currentValue;
        totalCost += costBasis;

        return {
          symbol: position.symbol,
          quantity: position.quantity,
          purchasePrice: position.purchasePrice || 0,
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
      const players = db.getPlayers();
      const allPositions = db.getPositions();
      const allSymbols = Array.from(new Set(allPositions.map(p => p.symbol)));
      
      // Fetch all stock prices
      const prices = await fetchMultipleStockPrices(allSymbols);
      Object.entries(prices).forEach(([symbol, price]) => {
        db.saveStockPrice(symbol, price);
      });

      const portfolios = players.map(player => {
        const positions = allPositions.filter(p => p.playerId === player.id);
        let totalValue = player.currentCash || 0;
        let totalCost = 0;

        const stockDetails = positions.map(position => {
          const currentPrice = prices[position.symbol] || position.purchasePrice || 0;
          const currentValue = position.quantity * currentPrice;
          const costBasis = position.quantity * (position.purchasePrice || 0);
          const gainLoss = currentValue - costBasis;
          const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;

          totalValue += currentValue;
          totalCost += costBasis;

          return {
            symbol: position.symbol,
            quantity: position.quantity,
            purchasePrice: position.purchasePrice || 0,
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
      });

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

