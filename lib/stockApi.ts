// Stock price fetching using Yahoo Finance API (free, no API key needed)
// Alternative: Alpha Vantage (requires API key)

export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}

export interface HistoricalPrice {
  date: string;
  price: number;
}

// Fetch historical prices for a stock (last N trading days)
export async function fetchHistoricalPrices(symbol: string, days: number = 5): Promise<HistoricalPrice[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol.toUpperCase()}?interval=1d&range=7d`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch historical data for ${symbol}: ${response.statusText}`);
      return [];
    }

    const data = await response.json();

    if (!data.chart?.result?.[0]?.timestamp || !data.chart?.result?.[0]?.indicators?.quote?.[0]?.close) {
      return [];
    }

    const timestamps = data.chart.result[0].timestamp;
    const closes = data.chart.result[0].indicators.quote[0].close;

    const historicalPrices: HistoricalPrice[] = [];
    for (let i = 0; i < timestamps.length && historicalPrices.length < days; i++) {
      if (closes[i] !== null && closes[i] !== undefined) {
        const date = new Date(timestamps[i] * 1000);
        historicalPrices.push({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          price: closes[i],
        });
      }
    }

    return historicalPrices;
  } catch (error) {
    console.error(`Error fetching historical prices for ${symbol}:`, error);
    return [];
  }
}

// Fetch historical prices with ISO date format for portfolio calculations
// startDate should be in YYYY-MM-DD format
export async function fetchHistoricalPricesWithDates(symbol: string, startDate?: string): Promise<{ date: string; price: number }[]> {
  try {
    // Calculate the range needed - from startDate to today, plus some buffer
    let range = '3mo'; // Default to 3 months to cover most cases

    if (startDate) {
      const start = new Date(startDate);
      const today = new Date();
      const daysDiff = Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff <= 7) range = '1mo';
      else if (daysDiff <= 30) range = '1mo';
      else if (daysDiff <= 90) range = '3mo';
      else if (daysDiff <= 180) range = '6mo';
      else range = '1y';
    }

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol.toUpperCase()}?interval=1d&range=${range}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch historical data for ${symbol}: ${response.statusText}`);
      return [];
    }

    const data = await response.json();

    if (!data.chart?.result?.[0]?.timestamp || !data.chart?.result?.[0]?.indicators?.quote?.[0]?.close) {
      return [];
    }

    const timestamps = data.chart.result[0].timestamp;
    const closes = data.chart.result[0].indicators.quote[0].close;

    const historicalPrices: { date: string; price: number }[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (closes[i] !== null && closes[i] !== undefined) {
        const date = new Date(timestamps[i] * 1000);
        // Use ISO date format (YYYY-MM-DD) for easier comparison
        const isoDate = date.toISOString().split('T')[0];
        historicalPrices.push({
          date: isoDate,
          price: closes[i],
        });
      }
    }

    // Filter to only include dates on or after startDate if provided
    if (startDate) {
      return historicalPrices.filter(p => p.date >= startDate);
    }

    return historicalPrices;
  } catch (error) {
    console.error(`Error fetching historical prices for ${symbol}:`, error);
    return [];
  }
}

// Helper function to normalize date strings to ISO format (YYYY-MM-DD)
export function normalizeDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];

  // If already in ISO format (YYYY-MM-DD), return as is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // Try parsing various formats
  // MM/DD/YYYY or M/D/YYYY
  const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const month = slashMatch[1].padStart(2, '0');
    const day = slashMatch[2].padStart(2, '0');
    const year = slashMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Try Date.parse as fallback
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  // Return today's date as last resort
  return new Date().toISOString().split('T')[0];
}

// Using Yahoo Finance API (free, no authentication)
export async function fetchStockPrice(symbol: string): Promise<number | null> {
  try {
    // Yahoo Finance API endpoint
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol.toUpperCase()}?interval=1d&range=1d`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch price for ${symbol}: ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    
    if (data.chart?.result?.[0]?.meta?.regularMarketPrice) {
      return data.chart.result[0].meta.regularMarketPrice;
    }

    // Fallback to previous close if market is closed
    if (data.chart?.result?.[0]?.meta?.previousClose) {
      return data.chart.result[0].meta.previousClose;
    }

    return null;
  } catch (error) {
    console.error(`Error fetching stock price for ${symbol}:`, error);
    return null;
  }
}

export async function fetchMultipleStockPrices(symbols: string[]): Promise<Record<string, number>> {
  const prices: Record<string, number> = {};
  
  // Fetch prices with a small delay to avoid rate limiting
  for (const symbol of symbols) {
    const price = await fetchStockPrice(symbol);
    if (price !== null) {
      prices[symbol] = price;
    }
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return prices;
}

// Alternative: Alpha Vantage API (requires API key)
// Set ALPHA_VANTAGE_API_KEY in environment variables
export async function fetchStockPriceAlphaVantage(symbol: string): Promise<number | null> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const quote = data['Global Quote'];
    
    if (quote && quote['05. price']) {
      return parseFloat(quote['05. price']);
    }

    return null;
  } catch (error) {
    console.error(`Error fetching Alpha Vantage price for ${symbol}:`, error);
    return null;
  }
}

