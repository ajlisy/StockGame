import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateTrade } from '@/lib/validation';
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

    const player = db.getPlayer(playerId);
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
    let price = db.getStockPrice(symbol);
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
      db.saveStockPrice(symbol, price);
    }

    // Validate trade
    const validation = validateTrade(player, symbol, type, quantity, price);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const totalAmount = quantity * price;

    // Execute trade
    if (type === 'BUY') {
      // Update cash
      player.currentCash -= totalAmount;
      db.savePlayer(player);

      // Update or create position
      const positions = db.getPlayerPositions(player.id);
      const existingPosition = positions.find(p => p.symbol === symbol);

      if (existingPosition) {
        // Update existing position (average cost)
        const totalCost = existingPosition.purchasePrice * existingPosition.quantity + totalAmount;
        const totalQuantity = existingPosition.quantity + quantity;
        existingPosition.purchasePrice = totalCost / totalQuantity;
        existingPosition.quantity = totalQuantity;
        db.savePosition(existingPosition);
      } else {
        // Create new position
        const newPosition: import('@/lib/db').Position = {
          id: `${Date.now()}-${Math.random()}`,
          playerId: player.id,
          symbol,
          quantity,
          purchasePrice: price,
          purchaseDate: new Date().toISOString().split('T')[0],
          createdAt: new Date().toISOString(),
        };
        db.savePosition(newPosition);
      }
    } else if (type === 'SELL') {
      // Update cash
      player.currentCash += totalAmount;
      db.savePlayer(player);

      // Update position
      const positions = db.getPlayerPositions(player.id);
      const position = positions.find(p => p.symbol === symbol);
      
      if (position) {
        if (position.quantity === quantity) {
          // Sell all shares - delete position
          db.deletePosition(position.id);
        } else {
          // Partial sale
          position.quantity -= quantity;
          db.savePosition(position);
        }
      }
    }

    // Record transaction
    const transaction: import('@/lib/db').Transaction = {
      id: `${Date.now()}-${Math.random()}`,
      playerId: player.id,
      symbol,
      type,
      quantity,
      price,
      totalAmount,
      date: new Date().toISOString(),
    };
    db.saveTransaction(transaction);

    return NextResponse.json({ 
      success: true, 
      transaction,
      newCashBalance: player.currentCash 
    });
  } catch (error) {
    console.error('Trade error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

