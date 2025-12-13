'use client';

import { useEffect, useState } from 'react';
import PortfolioCard from '@/components/PortfolioCard';
import Link from 'next/link';

interface Portfolio {
  player: {
    id: string;
    name: string;
    startingCash: number;
    currentCash: number;
    totalValue: number;
    totalGainLoss: number;
    totalGainLossPercent: number;
  };
  positions: Array<{
    symbol: string;
    quantity: number;
    purchasePrice: number;
    currentPrice: number;
    costBasis: number;
    currentValue: number;
    gainLoss: number;
    gainLossPercent: number;
  }>;
}

interface NewsData {
  playerId: string;
  summary: string;
  bullets: string[];
  loading: boolean;
}

export default function Home() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [currentPlayer, setCurrentPlayer] = useState<{ id: string; name: string } | null>(null);
  const [newsData, setNewsData] = useState<Record<string, NewsData>>({});

  useEffect(() => {
    checkAuth();
    fetchPortfolios();
    const interval = setInterval(fetchPortfolios, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/login');
      const data = await response.json();
      if (data.authenticated) {
        setAuthenticated(true);
        setCurrentPlayer(data.player);
      }
    } catch (error) {
      console.error('Auth check error:', error);
    }
  };

  const fetchPortfolios = async () => {
    try {
      const response = await fetch('/api/portfolio');
      const data = await response.json();
      if (data.portfolios) {
        setPortfolios(data.portfolios);
        setLastUpdated(new Date());
        // Fetch news for each portfolio
        data.portfolios.forEach((portfolio: Portfolio) => {
          fetchNewsForPlayer(portfolio);
        });
      }
    } catch (error) {
      console.error('Error fetching portfolios:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNewsForPlayer = async (portfolio: Portfolio) => {
    const playerId = portfolio.player.id;

    // Don't refetch if already loaded
    if (newsData[playerId] && !newsData[playerId].loading) {
      return;
    }

    setNewsData(prev => ({
      ...prev,
      [playerId]: { playerId, summary: '', bullets: [], loading: true }
    }));

    try {
      const response = await fetch('/api/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portfolio }),
      });
      const data = await response.json();

      setNewsData(prev => ({
        ...prev,
        [playerId]: {
          playerId,
          summary: data.summary || '',
          bullets: data.bullets || [],
          loading: false
        }
      }));
    } catch (error) {
      console.error('Error fetching news:', error);
      setNewsData(prev => ({
        ...prev,
        [playerId]: { playerId, summary: '', bullets: [], loading: false }
      }));
    }
  };

  const leader = portfolios.length > 0
    ? portfolios.reduce((prev, current) =>
        current.player.totalValue > prev.player.totalValue ? current : prev
      )
    : null;

  const renderNewsContent = (playerId: string) => {
    const news = newsData[playerId];

    if (!news || news.loading) {
      return (
        <div className="animate-pulse">
          <div className="h-4 bg-[#2f3336] rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-[#2f3336] rounded w-full mb-1"></div>
          <div className="h-3 bg-[#2f3336] rounded w-5/6"></div>
        </div>
      );
    }

    if (!news.summary && news.bullets.length === 0) {
      return null;
    }

    return (
      <div>
        <h4 className="text-sm font-semibold text-[#71767b] uppercase tracking-wider mb-2">Market Update</h4>
        {news.summary && (
          <p className="text-sm text-gray-300 mb-2">{news.summary}</p>
        )}
        {news.bullets.length > 0 && (
          <ul className="space-y-1">
            {news.bullets.map((bullet, idx) => (
              <li key={idx} className="text-sm text-gray-400 flex items-start gap-2">
                <span className="text-emerald-400 mt-1">•</span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1419] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-[#71767b]">Loading portfolios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1419]">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white">Stock Trading Competition</h1>
              <p className="text-[#71767b] mt-1">Track your portfolio performance in real-time</p>
            </div>
            <div className="flex gap-3">
              {authenticated ? (
                <>
                  <Link
                    href="/trade"
                    className="bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
                  >
                    Make Trade
                  </Link>
                  <button
                    onClick={async () => {
                      await fetch('/api/auth/login', { method: 'DELETE' });
                      setAuthenticated(false);
                      setCurrentPlayer(null);
                    }}
                    className="bg-[#2f3336] text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-[#3f4448] transition-colors"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  className="bg-[#1d9bf0] text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-[#1a8cd8] transition-colors"
                >
                  Login to Trade
                </Link>
              )}
            </div>
          </div>
          {lastUpdated && (
            <div className="flex items-center gap-2 text-sm text-[#71767b]">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              Last updated: {lastUpdated.toLocaleTimeString()}
            </div>
          )}
        </div>

        {/* Portfolio Cards */}
        {portfolios.length > 0 ? (
          <div className="grid lg:grid-cols-2 gap-6">
            {portfolios.map((portfolio) => (
              <PortfolioCard
                key={portfolio.player.id}
                portfolio={portfolio}
                isLeader={leader?.player.id === portfolio.player.id}
                newsContent={renderNewsContent(portfolio.player.id)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-[#16202a] rounded-xl border border-[#2f3336] p-8 text-center">
            <div className="text-4xl mb-4">📊</div>
            <p className="text-white text-lg mb-2">No portfolios found</p>
            <p className="text-[#71767b] text-sm mb-4">
              Upload initial positions via the admin page to get started.
            </p>
            <Link
              href="/admin"
              className="inline-block bg-[#1d9bf0] text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-[#1a8cd8] transition-colors"
            >
              Go to Admin
            </Link>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-[#2f3336] flex justify-between items-center">
          <p className="text-sm text-[#71767b]">
            P&L calculated from initial portfolio value (stocks + cash)
          </p>
          <Link
            href="/admin"
            className="text-sm text-[#71767b] hover:text-white transition-colors"
          >
            Admin Panel
          </Link>
        </div>
      </div>
    </div>
  );
}
