'use client';

import React, { useEffect, useState } from 'react';
import StockChart from './StockChart';
import PortfolioValueChart from './PortfolioValueChart';

interface HistoricalPrice {
  date: string;
  price: number;
}

interface PortfolioCardProps {
  portfolio: {
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
  };
  isLeader?: boolean;
  newsContent?: React.ReactNode;
}

export default function PortfolioCard({ portfolio, isLeader, newsContent }: PortfolioCardProps) {
  const { player, positions } = portfolio;
  const isPositive = player.totalGainLoss >= 0;
  const [historicalData, setHistoricalData] = useState<Record<string, HistoricalPrice[]>>({});

  useEffect(() => {
    const fetchHistory = async () => {
      const historyMap: Record<string, HistoricalPrice[]> = {};
      for (const position of positions) {
        try {
          const response = await fetch(`/api/stocks/history?symbol=${position.symbol}`);
          const data = await response.json();
          if (data.history) {
            historyMap[position.symbol] = data.history;
          }
        } catch (error) {
          console.error(`Error fetching history for ${position.symbol}:`, error);
        }
      }
      setHistoricalData(historyMap);
    };

    if (positions.length > 0) {
      fetchHistory();
    }
  }, [positions]);

  return (
    <div className={`bg-[#16202a] rounded-xl border ${isLeader ? 'border-emerald-500/50 shadow-lg shadow-emerald-500/10' : 'border-[#2f3336]'} overflow-hidden`}>
      {/* Header */}
      <div className={`px-6 py-4 ${isLeader ? 'bg-gradient-to-r from-emerald-500/20 to-transparent' : 'bg-[#1d2a35]'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${isLeader ? 'bg-emerald-500 text-white' : 'bg-[#2f3336] text-gray-300'}`}>
              {player.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{player.name}</h2>
              {isLeader && (
                <span className="text-xs text-emerald-400 font-medium">Leading</span>
              )}
            </div>
          </div>
          {isLeader && (
            <div className="text-2xl">🏆</div>
          )}
        </div>
      </div>

      {/* Portfolio Summary */}
      <div className="px-6 py-5 border-b border-[#2f3336]">
        <div className="text-sm text-[#71767b] mb-1">Total Portfolio Value</div>
        <div className="text-3xl font-bold text-white mb-2">
          ${player.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="flex items-center gap-4">
          <div>
            <span className={`text-lg font-semibold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPositive ? '+' : ''}${player.totalGainLoss.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={`ml-2 text-sm ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              ({isPositive ? '+' : ''}{player.totalGainLossPercent != null ? player.totalGainLossPercent.toFixed(2) : '0.00'}%)
            </span>
          </div>
        </div>
        <div className="mt-3 text-sm text-[#71767b]">
          Cash: <span className="text-white font-medium">${player.currentCash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </div>

      {/* Portfolio Value Chart */}
      <div className="px-6 py-4 border-b border-[#2f3336]">
        <PortfolioValueChart playerId={player.id} startingCash={player.startingCash} />
      </div>

      {/* News Section */}
      {newsContent && (
        <div className="px-6 py-4 border-b border-[#2f3336] bg-[#1d2a35]/50">
          {newsContent}
        </div>
      )}

      {/* Holdings */}
      {positions.length > 0 ? (
        <div className="px-6 py-4">
          <h3 className="text-sm font-semibold text-[#71767b] uppercase tracking-wider mb-3">Holdings</h3>
          <div className="space-y-4">
            {positions.map((position) => {
              const posIsPositive = position.gainLoss >= 0;
              const chartData = historicalData[position.symbol] || [];

              return (
                <div key={position.symbol} className="bg-[#1d2a35] rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-lg">{position.symbol}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${posIsPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                          {posIsPositive ? '+' : ''}{(position.gainLossPercent != null ? position.gainLossPercent : 0).toFixed(2)}%
                        </span>
                      </div>
                      <div className="text-sm text-[#71767b] mt-1">
                        {position.quantity} shares @ ${(position.currentPrice || 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-white">
                        ${position.currentValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className={`text-sm ${posIsPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                        {posIsPositive ? '+' : ''}${(position.gainLoss || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                  {/* Stock Chart */}
                  <div className="mt-2">
                    <StockChart data={chartData} isPositive={posIsPositive} height={60} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="px-6 py-8 text-center text-[#71767b]">
          No positions held
        </div>
      )}
    </div>
  );
}
