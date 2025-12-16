'use client';

import React, { useEffect, useState } from 'react';
import StockChart from './StockChart';
import PortfolioValueChart from './PortfolioValueChart';

interface HistoricalPrice {
  date: string;
  price: number;
}

interface Transaction {
  id: string;
  playerId: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  totalAmount: number;
  date: string;
  realizedPnL?: number | null;
}

interface PortfolioCardProps {
  portfolio: {
    player: {
      id: string;
      name: string;
      // New ledger-based fields
      cashBalance?: number;
      totalDeposited?: number;
      totalRealizedPnL?: number;
      totalUnrealizedPnL?: number;
      totalPnL?: number;
      totalPnLPercent?: number;
      todayChange?: number;
      todayChangePercent?: number;
      // Backwards compatibility
      startingCash?: number;
      currentCash?: number;
      totalValue: number;
      totalGainLoss?: number;
      totalGainLossPercent?: number;
    };
    positions: Array<{
      symbol: string;
      quantity: number;
      currentPrice: number;
      currentValue: number;
      // New ledger-based fields
      averageCostBasis?: number;
      totalCostBasis?: number;
      unrealizedPnL?: number;
      unrealizedPnLPercent?: number;
      firstPurchaseDate?: string;
      // Backwards compatibility
      purchasePrice?: number;
      purchaseDate?: string;
      costBasis?: number;
      gainLoss?: number;
      gainLossPercent?: number;
    }>;
  };
  isLeader?: boolean;
  newsContent?: React.ReactNode;
}

// Helper component for clickable stock symbols
function StockLink({ symbol }: { symbol: string }) {
  return (
    <a
      href={`https://www.google.com/finance/quote/${symbol}:NASDAQ`}
      target="_blank"
      rel="noopener noreferrer"
      className="font-bold text-white text-lg hover:text-[#1d9bf0] transition-colors"
      onClick={(e) => e.stopPropagation()}
    >
      {symbol}
    </a>
  );
}

export default function PortfolioCard({ portfolio, isLeader, newsContent }: PortfolioCardProps) {
  const { player, positions } = portfolio;

  // Use new ledger-based fields with fallback to old fields
  const totalPnL = player.totalPnL ?? player.totalGainLoss ?? 0;
  const totalPnLPercent = player.totalPnLPercent ?? player.totalGainLossPercent ?? 0;
  const cashBalance = player.cashBalance ?? player.currentCash ?? 0;
  const totalRealizedPnL = player.totalRealizedPnL ?? 0;
  const totalUnrealizedPnL = player.totalUnrealizedPnL ?? totalPnL;
  const totalDeposited = player.totalDeposited ?? player.startingCash ?? 0;
  const todayChange = player.todayChange ?? 0;
  const todayChangePercent = player.todayChangePercent ?? 0;

  const isPositive = totalPnL >= 0;
  const todayIsPositive = todayChange >= 0;
  const [historicalData, setHistoricalData] = useState<Record<string, HistoricalPrice[]>>({});
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);

  // Find the earliest purchase date to use as the start date for charts
  const earliestPurchaseDate = positions.length > 0
    ? positions
        .map(p => p.purchaseDate || p.firstPurchaseDate)
        .filter(Boolean)
        .sort()[0] || undefined
    : undefined;

  useEffect(() => {
    const fetchHistory = async () => {
      const historyMap: Record<string, HistoricalPrice[]> = {};
      for (const position of positions) {
        try {
          // Use the position's purchase date as the start date for the chart
          const startDate = position.purchaseDate || earliestPurchaseDate;
          const url = startDate
            ? `/api/stocks/history?symbol=${position.symbol}&startDate=${encodeURIComponent(startDate)}`
            : `/api/stocks/history?symbol=${position.symbol}`;

          const response = await fetch(url);
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
  }, [positions, earliestPurchaseDate]);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const response = await fetch(`/api/transactions?playerId=${player.id}`);
        const data = await response.json();
        if (data.transactions) {
          setTransactions(data.transactions);
        }
      } catch (error) {
        console.error('Error fetching transactions:', error);
      } finally {
        setLoadingTransactions(false);
      }
    };

    fetchTransactions();
  }, [player.id]);

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
        <div className="flex items-baseline gap-3 mb-2">
          <span className="text-3xl font-bold text-white">
            ${player.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className={`text-sm font-medium ${todayIsPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {todayIsPositive ? '+' : ''}${todayChange.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({todayIsPositive ? '+' : ''}{todayChangePercent.toFixed(2)}%) today
          </span>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <span className="text-sm text-[#71767b]">Total P&L: </span>
            <span className={`text-lg font-semibold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPositive ? '+' : ''}${totalPnL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={`ml-1 text-sm ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              ({isPositive ? '+' : ''}{totalPnLPercent.toFixed(2)}%)
            </span>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-4 text-sm">
          <div>
            <span className="text-[#71767b]">Unrealized: </span>
            <span className={`font-medium ${totalUnrealizedPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {totalUnrealizedPnL >= 0 ? '+' : ''}${totalUnrealizedPnL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div>
            <span className="text-[#71767b]">Realized: </span>
            <span className={`font-medium ${totalRealizedPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {totalRealizedPnL >= 0 ? '+' : ''}${totalRealizedPnL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
        <div className="mt-3 text-sm text-[#71767b]">
          Cash: <span className="text-white font-medium">${cashBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </div>

      {/* Portfolio Value Chart */}
      <div className="px-6 py-4 border-b border-[#2f3336]">
        <PortfolioValueChart playerId={player.id} startingCash={totalDeposited} />
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
              const unrealizedPnL = position.unrealizedPnL ?? position.gainLoss ?? 0;
              const unrealizedPnLPercent = position.unrealizedPnLPercent ?? position.gainLossPercent ?? 0;
              const avgCostBasis = position.averageCostBasis ?? position.purchasePrice ?? 0;
              const positionIsPositive = unrealizedPnL >= 0;
              const chartData = historicalData[position.symbol] || [];

              // Calculate today's change from historical data
              let todayChange = 0;
              let todayChangePercent = 0;
              if (chartData.length >= 2) {
                const todayPrice = chartData[chartData.length - 1]?.price || position.currentPrice;
                const yesterdayPrice = chartData[chartData.length - 2]?.price || todayPrice;
                todayChange = (todayPrice - yesterdayPrice) * position.quantity;
                todayChangePercent = yesterdayPrice !== 0 ? ((todayPrice - yesterdayPrice) / yesterdayPrice) * 100 : 0;
              }
              const todayIsPositive = todayChange >= 0;

              return (
                <div key={position.symbol} className="bg-[#1d2a35] rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <StockLink symbol={position.symbol} />
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${positionIsPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                          {positionIsPositive ? '+' : ''}{unrealizedPnLPercent.toFixed(2)}%
                        </span>
                      </div>
                      <div className="text-sm text-[#71767b] mt-1">
                        {position.quantity} shares @ ${(position.currentPrice || 0).toFixed(2)}
                        <span className="ml-2">Cost: ${avgCostBasis.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-white">
                        ${position.currentValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      {/* Today's P&L */}
                      <div className={`text-xs ${todayIsPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                        Today: {todayIsPositive ? '+' : ''}${todayChange.toFixed(2)} ({todayIsPositive ? '+' : ''}{todayChangePercent.toFixed(2)}%)
                      </div>
                      {/* Unrealized P&L */}
                      <div className={`text-sm ${positionIsPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                        Unrealized: {positionIsPositive ? '+' : ''}${unrealizedPnL.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  {/* Stock Chart */}
                  <div className="mt-2">
                    <StockChart data={chartData} isPositive={positionIsPositive} height={60} />
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

      {/* Trade Log */}
      <div className="px-6 py-4 border-t border-[#2f3336]">
        <h3 className="text-sm font-semibold text-[#71767b] uppercase tracking-wider mb-3">Trade History</h3>
        {loadingTransactions ? (
          <div className="animate-pulse">
            <div className="h-4 bg-[#2f3336] rounded w-full mb-2"></div>
            <div className="h-4 bg-[#2f3336] rounded w-3/4"></div>
          </div>
        ) : transactions.length > 0 ? (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {transactions.slice(0, 10).map((tx) => {
              const hasRealizedPnL = tx.type === 'SELL' && tx.realizedPnL != null;
              const realizedPnL = tx.realizedPnL ?? 0;
              const pnlIsPositive = realizedPnL >= 0;

              return (
                <div key={tx.id} className="flex justify-between items-center text-sm py-2 border-b border-[#2f3336] last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${tx.type === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                      {tx.type}
                    </span>
                    <a
                      href={`https://www.google.com/finance/quote/${tx.symbol}:NASDAQ`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-white hover:text-[#1d9bf0] transition-colors"
                    >
                      {tx.symbol}
                    </a>
                    <span className="text-[#71767b]">x{tx.quantity}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-white font-medium">${tx.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className="text-[#71767b] text-xs ml-2">@ ${tx.price.toFixed(2)}</span>
                    {hasRealizedPnL && (
                      <span className={`text-xs ml-2 ${pnlIsPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                        ({pnlIsPositive ? '+' : ''}${realizedPnL.toFixed(2)})
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {transactions.length > 10 && (
              <p className="text-xs text-[#71767b] text-center pt-2">
                Showing 10 of {transactions.length} trades
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-[#71767b]">No trades yet</p>
        )}
      </div>
    </div>
  );
}
