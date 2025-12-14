import { NextRequest, NextResponse } from 'next/server';
import { fetchHistoricalPricesWithDates, normalizeDate } from '@/lib/stockApi';

export async function GET(request: NextRequest) {
  try {
    const symbol = request.nextUrl.searchParams.get('symbol');
    const startDate = request.nextUrl.searchParams.get('startDate');

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol is required' },
        { status: 400 }
      );
    }

    // Normalize start date if provided
    const normalizedStartDate = startDate ? normalizeDate(startDate) : undefined;

    // Fetch historical prices from start date to today
    const rawHistory = await fetchHistoricalPricesWithDates(symbol, normalizedStartDate);

    // Convert to the format expected by the frontend (with shorter date display)
    const history = rawHistory.map(h => ({
      date: new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      price: h.price,
    }));

    return NextResponse.json({ symbol, history });
  } catch (error) {
    console.error('Stock history error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
