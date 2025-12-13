// News fetching utilities for stock market news
// Uses web search to find recent headlines

export interface NewsHeadline {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  source: string;
}

// Fetch news headlines for a specific stock symbol
export async function fetchStockNews(symbol: string, daysBack: number = 7): Promise<NewsHeadline[]> {
  try {
    // Use a simple Yahoo Finance news scraping approach
    const url = `https://finance.yahoo.com/quote/${symbol}/news`;

    // For now, return a placeholder structure
    // In production, you'd implement actual web scraping or use a news API
    return [
      {
        title: `${symbol} market activity`,
        description: `Recent market movements for ${symbol}`,
        url: url,
        publishedAt: new Date().toISOString(),
        source: 'Yahoo Finance'
      }
    ];
  } catch (error) {
    console.error(`Error fetching news for ${symbol}:`, error);
    return [];
  }
}

// Fetch general market news
export async function fetchMarketNews(daysBack: number = 7): Promise<NewsHeadline[]> {
  try {
    // Placeholder for market news
    return [
      {
        title: 'Market overview',
        description: 'Recent market trends and movements',
        url: 'https://finance.yahoo.com',
        publishedAt: new Date().toISOString(),
        source: 'Market News'
      }
    ];
  } catch (error) {
    console.error('Error fetching market news:', error);
    return [];
  }
}

// Determine the main sectors for a portfolio
export function analyzeSectors(positions: Array<{ symbol: string; currentValue: number }>): string[] {
  // Stock symbol to sector mapping (simplified)
  const sectorMap: Record<string, string> = {
    // Tech
    'AAPL': 'Technology',
    'MSFT': 'Technology',
    'GOOGL': 'Technology',
    'META': 'Technology',
    'NVDA': 'Technology',
    'AMD': 'Technology',
    'AVGO': 'Technology',
    'TSM': 'Technology',
    'MU': 'Technology',
    'ASML': 'Technology',
    // Consumer
    'TSLA': 'Consumer Cyclical',
    'WMT': 'Consumer Defensive',
    'MCD': 'Consumer Cyclical',
    // Financial
    'SPY': 'Market Index',
    // Healthcare
    'LLY': 'Healthcare',
    // Gaming/Entertainment
    'EA': 'Entertainment',
    'RBLX': 'Entertainment',
    'DKNG': 'Entertainment',
    // Financial Services
    'FICO': 'Financial Services',
    // Energy/Utilities
    'OKLO': 'Energy',
  };

  // Calculate sector allocation
  const sectorValues: Record<string, number> = {};
  let totalValue = 0;

  for (const position of positions) {
    const sector = sectorMap[position.symbol] || 'Other';
    sectorValues[sector] = (sectorValues[sector] || 0) + position.currentValue;
    totalValue += position.currentValue;
  }

  // Sort sectors by value
  const sortedSectors = Object.entries(sectorValues)
    .sort(([, a], [, b]) => b - a)
    .map(([sector]) => sector);

  // Return top 2 sectors
  return sortedSectors.slice(0, 2);
}

// Fetch sector-specific news
export async function fetchSectorNews(sector: string, daysBack: number = 7): Promise<NewsHeadline[]> {
  try {
    // Placeholder for sector news
    return [
      {
        title: `${sector} sector update`,
        description: `Recent developments in ${sector}`,
        url: 'https://finance.yahoo.com',
        publishedAt: new Date().toISOString(),
        source: 'Sector News'
      }
    ];
  } catch (error) {
    console.error(`Error fetching news for sector ${sector}:`, error);
    return [];
  }
}
