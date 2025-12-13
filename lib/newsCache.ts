import fs from 'fs';
import path from 'path';

interface CachedNews {
  playerId: string;
  weekSummary: string;
  weekBullets: string[];
  todaySummary: string;
  todayBullets: string[];
  cachedAt: string; // ISO timestamp
  cacheDate: string; // YYYY-MM-DD in EST
}

const DATA_DIR = process.env.AWS_LAMBDA_FUNCTION_NAME ? '/tmp/data' : path.join(process.cwd(), 'data');
const CACHE_FILE = path.join(DATA_DIR, 'newsCache.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function isMarketClosed(): boolean {
  // Get current time in EST
  const now = new Date();
  const estTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));

  const hours = estTime.getHours();
  const minutes = estTime.getMinutes();

  // Market closes at 4:00 PM EST (16:00)
  // We check if it's after 3:30 PM EST (15:30)
  const currentMinutes = hours * 60 + minutes;
  const cutoffMinutes = 15 * 60 + 30; // 3:30 PM

  return currentMinutes >= cutoffMinutes;
}

export function getCachedNews(playerId: string): CachedNews | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) {
      return null;
    }

    const cacheData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    const playerCache = cacheData[playerId];

    if (!playerCache) {
      return null;
    }

    // Get current date in EST
    const now = new Date();
    const estDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const todayEST = estDate.toISOString().split('T')[0]; // YYYY-MM-DD

    // Check if cache is from today (after 3:30 PM EST)
    if (playerCache.cacheDate === todayEST) {
      return playerCache;
    }

    return null;
  } catch (error) {
    console.error('Error reading news cache:', error);
    return null;
  }
}

export function setCachedNews(playerId: string, news: Omit<CachedNews, 'playerId' | 'cachedAt' | 'cacheDate'>): void {
  try {
    let cacheData: Record<string, CachedNews> = {};

    if (fs.existsSync(CACHE_FILE)) {
      cacheData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    }

    // Get current date in EST
    const now = new Date();
    const estDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const todayEST = estDate.toISOString().split('T')[0]; // YYYY-MM-DD

    cacheData[playerId] = {
      playerId,
      ...news,
      cachedAt: new Date().toISOString(),
      cacheDate: todayEST,
    };

    fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2));
  } catch (error) {
    console.error('Error writing news cache:', error);
  }
}

export function shouldGenerateNews(): boolean {
  // Only generate news after market close (3:30 PM EST)
  return isMarketClosed();
}
