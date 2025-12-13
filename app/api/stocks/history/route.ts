import { NextRequest, NextResponse } from 'next/server';
import { fetchHistoricalPrices } from '@/lib/stockApi';

export async function GET(request: NextRequest) {
  try {
    const symbol = request.nextUrl.searchParams.get('symbol');
    const days = parseInt(request.nextUrl.searchParams.get('days') || '5');

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol is required' },
        { status: 400 }
      );
    }

    const history = await fetchHistoricalPrices(symbol, days);

    return NextResponse.json({ symbol, history });
  } catch (error) {
    console.error('Stock history error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
