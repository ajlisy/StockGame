'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function PortfolioPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [player, setPlayer] = useState<{ id: string; name: string } | null>(null);
  const [portfolio, setPortfolio] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
    const interval = setInterval(() => {
      if (player) {
        fetchPortfolio(player.id);
      }
    }, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [player]);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading portfolio...</p>
        </div>
      </div>
    );
  }

  if (!authenticated || !player || !portfolio) {
    return null;
  }

  const { player: playerData, positions } = portfolio;
  const isPositive = playerData.totalGainLoss >= 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-800 underline mb-4 inline-block"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-800">{playerData.name}'s Portfolio</h1>
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Summary Cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="text-sm text-gray-600 mb-1">Total Value</div>
              <div className={`text-3xl font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                ${playerData.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="text-sm text-gray-600 mb-1">Total P&L</div>
              <div className={`text-3xl font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {isPositive ? '+' : ''}${playerData.totalGainLoss.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className={`text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {isPositive ? '+' : ''}{(playerData.totalGainLossPercent != null ? playerData.totalGainLossPercent : 0).toFixed(2)}%
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="text-sm text-gray-600 mb-1">Cash Available</div>
              <div className="text-3xl font-bold text-gray-800">
                ${playerData.currentCash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Positions Table */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Current Positions</h2>
            {positions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Symbol</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Quantity</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Purchase Price</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Current Price</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Cost Basis</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Current Value</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Gain/Loss</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((position: any) => {
                      const posIsPositive = position.gainLoss >= 0;
                      return (
                        <tr key={position.symbol} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 font-semibold text-gray-800">{position.symbol}</td>
                          <td className="text-right py-3 px-4">{position.quantity}</td>
                          <td className="text-right py-3 px-4">${(position.purchasePrice || 0).toFixed(2)}</td>
                          <td className="text-right py-3 px-4">${(position.currentPrice || 0).toFixed(2)}</td>
                          <td className="text-right py-3 px-4">${(position.costBasis || 0).toFixed(2)}</td>
                          <td className="text-right py-3 px-4">${(position.currentValue || 0).toFixed(2)}</td>
                          <td className={`text-right py-3 px-4 font-semibold ${posIsPositive ? 'text-green-600' : 'text-red-600'}`}>
                            {posIsPositive ? '+' : ''}${(position.gainLoss || 0).toFixed(2)} ({posIsPositive ? '+' : ''}{(position.gainLossPercent != null ? position.gainLossPercent : 0).toFixed(2)}%)
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No positions held</p>
            )}
          </div>

          <div className="mt-6 text-center">
            <Link
              href="/trade"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors inline-block"
            >
              Make a Trade
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

