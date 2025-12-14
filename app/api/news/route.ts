import { NextRequest, NextResponse } from 'next/server';
import { fetchHistoricalPrices } from '@/lib/stockApi';
import { analyzeSectors } from '@/lib/newsApi';
import { getCachedNews, setCachedNews, shouldGenerateNews } from '@/lib/newsCache';
import Anthropic from '@anthropic-ai/sdk';

interface PortfolioPosition {
  symbol: string;
  quantity: number;
  purchasePrice: number;
  currentPrice: number;
  costBasis: number;
  currentValue: number;
  gainLoss: number;
  gainLossPercent: number;
}

interface Portfolio {
  player: {
    id: string;
    name: string;
    totalValue: number;
    totalGainLoss: number;
    totalGainLossPercent: number;
    startingCash: number;
    currentCash: number;
  };
  positions: PortfolioPosition[];
}

interface HistoricalPrice {
  date: string;
  price: number;
}

export async function POST(request: NextRequest) {
  try {
    const { portfolio, forceRefresh } = await request.json() as { portfolio: Portfolio; forceRefresh?: boolean };

    if (!portfolio || !portfolio.positions || portfolio.positions.length === 0) {
      return NextResponse.json({
        weekSummary: '',
        weekBullets: [],
        todaySummary: '',
        todayBullets: [],
      });
    }

    // Check if we have fresh cached news (skip if forceRefresh)
    if (!forceRefresh) {
      const cachedNews = await getCachedNews(portfolio.player.id);
      if (cachedNews) {
        console.log(`Using cached news for ${portfolio.player.name}`);
        return NextResponse.json({
          weekSummary: cachedNews.weekSummary,
          weekBullets: cachedNews.weekBullets,
          todaySummary: cachedNews.todaySummary,
          todayBullets: cachedNews.todayBullets,
          cached: true,
        });
      }
    } else {
      console.log(`Force refreshing news for ${portfolio.player.name}`);
    }

    // Check if it's after market close (3:30 PM EST) - skip check if forceRefresh
    if (!forceRefresh && !shouldGenerateNews()) {
      console.log('Market not closed yet. Using fallback news.');
      return generateFallbackNews(portfolio);
    }

    // Check if API key is configured
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn('ANTHROPIC_API_KEY not configured. Using fallback news generation.');
      return generateFallbackNews(portfolio);
    }

    // Fetch historical prices for all positions
    const historicalData: Record<string, HistoricalPrice[]> = {};
    for (const position of portfolio.positions) {
      const history = await fetchHistoricalPrices(position.symbol, 7);
      historicalData[position.symbol] = history;
    }

    // Determine top sectors
    const topSectors = analyzeSectors(portfolio.positions);

    // Gather context for Claude
    const portfolioContext = buildPortfolioContext(portfolio, historicalData, topSectors);

    // Use Claude to analyze and generate news
    const anthropic = new Anthropic({ apiKey });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are a financial analyst providing portfolio updates. Analyze the following portfolio and market data to generate concise, actionable insights.

${portfolioContext}

Generate a JSON response with the following structure:
{
  "weekSummary": "Brief 1-sentence summary of key portfolio drivers over the past week",
  "weekBullets": ["2-3 specific bullet points about the most important portfolio movements this week"],
  "todaySummary": "Brief 1-sentence summary of key portfolio drivers today",
  "todayBullets": ["2-3 specific bullet points about the most important portfolio movements today"]
}

Focus on:
1. Stock-specific news that actually affected the portfolio
2. Sector trends in the portfolio's top sectors: ${topSectors.join(', ')}
3. Macro market movements that impacted the overall portfolio

Be specific with percentages and dollar amounts from the data provided. Only mention what's truly significant.`
        }
      ]
    });

    // Parse Claude's response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    const newsData = parseClaudeResponse(responseText);

    // Cache the results
    await setCachedNews(portfolio.player.id, newsData);
    console.log(`Cached news for ${portfolio.player.name}`);

    return NextResponse.json(newsData);
  } catch (error) {
    console.error('News generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate news' },
      { status: 500 }
    );
  }
}

function buildPortfolioContext(
  portfolio: Portfolio,
  historicalData: Record<string, HistoricalPrice[]>,
  topSectors: string[]
): string {
  const { player, positions } = portfolio;

  let context = `PORTFOLIO: ${player.name}\n`;
  context += `Total Value: $${player.totalValue.toLocaleString()}\n`;
  context += `Total P&L: ${player.totalGainLoss >= 0 ? '+' : ''}$${player.totalGainLoss.toLocaleString()} (${player.totalGainLossPercent.toFixed(2)}%)\n`;
  context += `Top Sectors: ${topSectors.join(', ')}\n\n`;

  context += `POSITIONS:\n`;
  for (const position of positions) {
    const history = historicalData[position.symbol] || [];

    // Calculate daily and weekly changes
    let dailyChange = 0;
    let weeklyChange = 0;

    if (history.length >= 2) {
      const latest = history[history.length - 1]?.price || position.currentPrice;
      const yesterday = history[history.length - 2]?.price || latest;
      dailyChange = ((latest - yesterday) / yesterday) * 100;
    }

    if (history.length >= 5) {
      const latest = history[history.length - 1]?.price || position.currentPrice;
      const weekAgo = history[0]?.price || latest;
      weeklyChange = ((latest - weekAgo) / weekAgo) * 100;
    }

    context += `- ${position.symbol}: ${position.quantity} shares @ $${position.currentPrice.toFixed(2)}\n`;
    context += `  Value: $${position.currentValue.toLocaleString()}, P&L: ${position.gainLoss >= 0 ? '+' : ''}$${position.gainLoss.toFixed(2)} (${position.gainLossPercent.toFixed(2)}%)\n`;
    if (dailyChange !== 0) {
      context += `  Daily Change: ${dailyChange >= 0 ? '+' : ''}${dailyChange.toFixed(2)}%\n`;
    }
    if (weeklyChange !== 0) {
      context += `  Weekly Change: ${weeklyChange >= 0 ? '+' : ''}${weeklyChange.toFixed(2)}%\n`;
    }
  }

  return context;
}

function parseClaudeResponse(responseText: string): {
  weekSummary: string;
  weekBullets: string[];
  todaySummary: string;
  todayBullets: string[];
} {
  try {
    // Try to extract JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        weekSummary: parsed.weekSummary || '',
        weekBullets: Array.isArray(parsed.weekBullets) ? parsed.weekBullets : [],
        todaySummary: parsed.todaySummary || '',
        todayBullets: Array.isArray(parsed.todayBullets) ? parsed.todayBullets : [],
      };
    }
  } catch (error) {
    console.error('Error parsing Claude response:', error);
  }

  // Fallback if parsing fails
  return {
    weekSummary: '',
    weekBullets: [],
    todaySummary: '',
    todayBullets: [],
  };
}

function generateFallbackNews(portfolio: Portfolio): NextResponse {
  // Simple fallback when API key is not configured
  const { player, positions } = portfolio;
  const isPositive = player.totalGainLoss >= 0;
  const performanceWord = isPositive ? 'up' : 'down';

  const weekBullets: string[] = [];
  const todayBullets: string[] = [];

  // Analyze positions for weekly performance
  const sortedByGain = [...positions].sort((a, b) => b.gainLoss - a.gainLoss);
  const topWinner = sortedByGain[0];
  const topLoser = sortedByGain[sortedByGain.length - 1];

  if (topWinner && topWinner.gainLoss > 0) {
    weekBullets.push(
      `${topWinner.symbol} leading gains with +${topWinner.gainLossPercent.toFixed(2)}% performance since purchase.`
    );
  }

  if (topLoser && topLoser.gainLoss < 0) {
    weekBullets.push(
      `${topLoser.symbol} underperforming with ${topLoser.gainLossPercent.toFixed(2)}% decline since purchase.`
    );
  }

  weekBullets.push(
    `Overall portfolio ${performanceWord} ${Math.abs(player.totalGainLossPercent).toFixed(2)}% from initial value.`
  );

  // For today, use similar but different phrasing
  todayBullets.push(
    `Portfolio currently valued at $${player.totalValue.toLocaleString()}.`
  );

  if (positions.length > 0) {
    todayBullets.push(
      `Holding ${positions.length} position${positions.length !== 1 ? 's' : ''} across ${new Set(positions.map(p => p.symbol)).size} stocks.`
    );
  }

  return NextResponse.json({
    weekSummary: `Portfolio ${performanceWord} ${Math.abs(player.totalGainLossPercent).toFixed(2)}% over the tracking period.`,
    weekBullets: weekBullets.slice(0, 3),
    todaySummary: `Current portfolio status as of today.`,
    todayBullets: todayBullets.slice(0, 3),
  });
}
