import { NextRequest, NextResponse } from 'next/server';
import { fetchStockPrice, fetchMultipleStockPrices } from '@/lib/stockApi';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const symbol = request.nextUrl.searchParams.get('symbol');
    const symbols = request.nextUrl.searchParams.get('symbols');

    if (symbol) {
      // Fetch single stock price
      let price = await db.getStockPrice(symbol);
      
      if (!price) {
        price = await fetchStockPrice(symbol);
        if (price) {
          await db.saveStockPrice(symbol, price);
        }
      }

      if (!price) {
        return NextResponse.json(
          { error: 'Could not fetch stock price' },
          { status: 404 }
        );
      }

      return NextResponse.json({ symbol, price });
    } else if (symbols) {
      // Fetch multiple stock prices
      const symbolList = symbols.split(',').map(s => s.trim());
      const prices = await fetchMultipleStockPrices(symbolList);
      
      // Update cache
      for (const [symbol, price] of Object.entries(prices)) {
        await db.saveStockPrice(symbol, price);
      }

      return NextResponse.json({ prices });
    } else {
      return NextResponse.json(
        { error: 'Symbol or symbols parameter required' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Stock price error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

