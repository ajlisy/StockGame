import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { executeTrade } from '@/lib/ledger';
import { fetchStockPrice } from '@/lib/stockApi';

export async function POST(request: NextRequest) {
  try {
    const playerId = request.cookies.get('playerId')?.value;

    if (!playerId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const player = await db.getPlayer(playerId);
    if (!player) {
      return NextResponse.json(
        { error: 'Player not found' },
        { status: 404 }
      );
    }

    const { symbol, type, quantity } = await request.json();

    if (!symbol || !type || !quantity) {
      return NextResponse.json(
        { error: 'Symbol, type, and quantity are required' },
        { status: 400 }
      );
    }

    if (type !== 'BUY' && type !== 'SELL') {
      return NextResponse.json(
        { error: 'Type must be BUY or SELL' },
        { status: 400 }
      );
    }

    // Fetch current stock price
    let price = await db.getStockPrice(symbol);
    if (!price) {
      // Fetch from API if not cached
      const fetchedPrice = await fetchStockPrice(symbol);
      if (!fetchedPrice) {
        return NextResponse.json(
          { error: 'Could not fetch stock price' },
          { status: 400 }
        );
      }
      price = fetchedPrice;
      await db.saveStockPrice(symbol, price);
    }

    // Execute trade using ledger
    const result = await executeTrade(playerId, symbol, type, quantity, price);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      ledgerEntry: result.ledgerEntry,
      playerSummary: result.playerSummary,
      positionSummary: result.positionSummary,
      // For backwards compatibility
      newCashBalance: result.playerSummary?.cashBalance ?? 0,
    });
  } catch (error) {
    console.error('Trade error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
