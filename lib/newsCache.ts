import { db, NewsCache } from './db';

// Check if a cache is fresh (updated after 4:30 PM CST the previous day)
export function isCacheFresh(cachedAt: string): boolean {
  if (!cachedAt) return false;

  const cacheTime = new Date(cachedAt);
  const now = new Date();

  // Get current time in CST
  const cstNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));

  // Calculate 4:30 PM CST yesterday
  const cutoffTime = new Date(cstNow);
  cutoffTime.setDate(cutoffTime.getDate() - 1); // Yesterday
  cutoffTime.setHours(16, 30, 0, 0); // 4:30 PM

  // Cache is fresh if it was updated after 4:30 PM CST yesterday
  return cacheTime > cutoffTime;
}

// Get cached news for a player (returns null if cache is stale or doesn't exist)
export async function getCachedNews(playerId: string): Promise<NewsCache | null> {
  try {
    const cache = await db.getNewsCache(playerId);

    if (!cache) {
      console.log(`[NewsCache] No cache found for player ${playerId}`);
      return null;
    }

    // Check if cache is fresh
    if (isCacheFresh(cache.cachedAt)) {
      console.log(`[NewsCache] Using fresh cache for player ${playerId} (cached at ${cache.cachedAt})`);
      return cache;
    }

    console.log(`[NewsCache] Cache is stale for player ${playerId} (cached at ${cache.cachedAt})`);
    return null;
  } catch (error) {
    console.error('[NewsCache] Error reading cache:', error);
    return null;
  }
}

// Save news to cache
export async function setCachedNews(
  playerId: string,
  news: {
    weekSummary: string;
    weekBullets: string[];
    todaySummary: string;
    todayBullets: string[];
  }
): Promise<void> {
  try {
    const cache: NewsCache = {
      playerId,
      weekSummary: news.weekSummary,
      weekBullets: news.weekBullets,
      todaySummary: news.todaySummary,
      todayBullets: news.todayBullets,
      cachedAt: new Date().toISOString(),
    };

    await db.saveNewsCache(cache);
    console.log(`[NewsCache] Saved cache for player ${playerId}`);
  } catch (error) {
    console.error('[NewsCache] Error writing cache:', error);
  }
}

// Check if it's after market close (4:00 PM EST / 3:00 PM CST)
export function isMarketClosed(): boolean {
  const now = new Date();
  const cstTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));

  const hours = cstTime.getHours();
  const minutes = cstTime.getMinutes();

  // Market closes at 4:00 PM EST = 3:00 PM CST
  // We check if it's after 3:30 PM CST (giving 30 min buffer for settlement)
  const currentMinutes = hours * 60 + minutes;
  const cutoffMinutes = 15 * 60 + 30; // 3:30 PM CST

  return currentMinutes >= cutoffMinutes;
}

// Check if we should generate new news
export function shouldGenerateNews(): boolean {
  return isMarketClosed();
}
