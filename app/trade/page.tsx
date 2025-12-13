'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TradeForm from '@/components/TradeForm';
import Link from 'next/link';

interface Position {
  symbol: string;
  quantity: number;
}

export default function TradePage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [player, setPlayer] = useState<{ id: string; name: string } | null>(null);
  const [portfolio, setPortfolio] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/login');
      const data = await response.json();
      if (data.authenticated) {
        setAuthenticated(true);
        setPlayer(data.player);
        fetchPortfolio(data.player.id);
      } else {
        router.push('/login');
      }
    } catch (error) {
      console.error('Auth check error:', error);
      router.push('/login');
    }
  };

  const fetchPortfolio = async (playerId: string) => {
    try {
      const response = await fetch(`/api/portfolio?playerId=${playerId}`);
      const data = await response.json();
      if (data.player) {
        setPortfolio(data);
      }
    } catch (error) {
      console.error('Error fetching portfolio:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTradeSuccess = () => {
    if (player) {
      fetchPortfolio(player.id);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1419] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-[#71767b]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!authenticated || !player || !portfolio) {
    return null;
  }

  const currentPositions: Position[] = portfolio.positions.map((p: any) => ({
    symbol: p.symbol,
    quantity: p.quantity,
  }));

  return (
    <div className="min-h-screen bg-[#0f1419]">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[#1d9bf0] hover:text-[#1a8cd8] transition-colors mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Trading</h1>
              <p className="text-[#71767b] mt-1">Execute buy and sell orders</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-[#71767b]">Logged in as</p>
              <p className="text-lg font-semibold text-white">{player.name}</p>
            </div>
          </div>
        </div>

        {/* Portfolio Summary */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="bg-[#16202a] rounded-xl border border-[#2f3336] p-5">
            <p className="text-sm text-[#71767b] mb-1">Available Cash</p>
            <p className="text-2xl font-bold text-white">
              ${portfolio.player.currentCash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-[#16202a] rounded-xl border border-[#2f3336] p-5">
            <p className="text-sm text-[#71767b] mb-1">Portfolio Value</p>
            <p className="text-2xl font-bold text-white">
              ${portfolio.player.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-[#16202a] rounded-xl border border-[#2f3336] p-5">
            <p className="text-sm text-[#71767b] mb-1">Total P&L</p>
            <p className={`text-2xl font-bold ${portfolio.player.totalGainLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {portfolio.player.totalGainLoss >= 0 ? '+' : ''}${portfolio.player.totalGainLoss.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Current Holdings */}
        {currentPositions.length > 0 && (
          <div className="bg-[#16202a] rounded-xl border border-[#2f3336] p-6 mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">Current Holdings</h2>
            <div className="space-y-3">
              {portfolio.positions.map((pos: any) => (
                <div key={pos.symbol} className="flex justify-between items-center p-3 bg-[#1d2a35] rounded-lg">
                  <div>
                    <span className="font-bold text-white">{pos.symbol}</span>
                    <span className="text-[#71767b] ml-2">{pos.quantity} shares</span>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-medium">${pos.currentValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <p className={`text-sm ${pos.gainLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {pos.gainLoss >= 0 ? '+' : ''}${pos.gainLoss.toFixed(2)} ({pos.gainLoss >= 0 ? '+' : ''}{pos.gainLossPercent.toFixed(2)}%)
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trade Form */}
        <div className="max-w-2xl mx-auto">
          <TradeForm
            playerId={player.id}
            currentCash={portfolio.player.currentCash}
            currentPositions={currentPositions}
            onTradeSuccess={handleTradeSuccess}
          />
        </div>
      </div>
    </div>
  );
}
