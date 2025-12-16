'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Position {
  symbol: string;
  quantity: number;
  currentPrice: number;
  currentValue: number;
  averageCostBasis: number;
  totalCostBasis: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  // For backwards compatibility
  gainLoss: number;
  gainLossPercent: number;
}

export default function TradePage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [player, setPlayer] = useState<{ id: string; name: string } | null>(null);
  const [portfolio, setPortfolio] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Trading ticket state
  const [ticketSymbol, setTicketSymbol] = useState('');
  const [ticketQuantity, setTicketQuantity] = useState('');
  const [ticketType, setTicketType] = useState<'BUY' | 'SELL'>('BUY');
  const [ticketPrice, setTicketPrice] = useState<number | null>(null);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [tradeLoading, setTradeLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
      // Add timestamp to bust cache after trades
      const response = await fetch(`/api/portfolio?playerId=${playerId}&_t=${Date.now()}`, {
        cache: 'no-store'
      });
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

  const fetchPrice = async (symbol: string) => {
    if (!symbol) return null;
    setFetchingPrice(true);
    try {
      const response = await fetch(`/api/stocks?symbol=${symbol}`);
      const data = await response.json();
      if (data.price) {
        setTicketPrice(data.price);
        return data.price;
      } else {
        setError('Could not fetch stock price');
        setTicketPrice(null);
        return null;
      }
    } catch (err) {
      setError('Error fetching stock price');
      setTicketPrice(null);
      return null;
    } finally {
      setFetchingPrice(false);
    }
  };

  useEffect(() => {
    if (ticketSymbol && ticketSymbol.length >= 1) {
      const timeoutId = setTimeout(() => {
        fetchPrice(ticketSymbol);
      }, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setTicketPrice(null);
    }
  }, [ticketSymbol]);

  const executeTrade = async (symbol: string, type: 'BUY' | 'SELL', quantity: number) => {
    setTradeLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: symbol.toUpperCase(), type, quantity }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Trade failed');
        return false;
      }

      setSuccess(`Successfully ${type === 'BUY' ? 'bought' : 'sold'} ${quantity} shares of ${symbol.toUpperCase()}`);
      if (player) {
        fetchPortfolio(player.id);
      }
      return true;
    } catch (err) {
      setError('Network error. Please try again.');
      return false;
    } finally {
      setTradeLoading(false);
    }
  };

  const handleTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(ticketQuantity);
    if (!qty || qty <= 0) {
      setError('Please enter a valid quantity');
      return;
    }
    if (!ticketSymbol) {
      setError('Please enter a stock symbol');
      return;
    }

    const success = await executeTrade(ticketSymbol, ticketType, qty);
    if (success) {
      setTicketSymbol('');
      setTicketQuantity('');
      setTicketPrice(null);
    }
  };

  const handleQuickTrade = async (symbol: string, type: 'BUY' | 'SELL', maxQty?: number) => {
    const qtyStr = prompt(`Enter number of shares to ${type.toLowerCase()}${maxQty ? ` (max ${maxQty})` : ''}:`);
    if (!qtyStr) return;

    const qty = parseInt(qtyStr);
    if (!qty || qty <= 0) {
      setError('Please enter a valid quantity');
      return;
    }
    if (maxQty && qty > maxQty) {
      setError(`Cannot ${type.toLowerCase()} more than ${maxQty} shares`);
      return;
    }

    await executeTrade(symbol, type, qty);
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

  const positions: Position[] = portfolio.positions.map((p: any) => ({
    symbol: p.symbol,
    quantity: p.quantity,
    currentPrice: p.currentPrice,
    currentValue: p.currentValue,
    averageCostBasis: p.averageCostBasis || p.purchasePrice || 0,
    totalCostBasis: p.totalCostBasis || (p.quantity * (p.averageCostBasis || p.purchasePrice || 0)),
    unrealizedPnL: p.unrealizedPnL ?? p.gainLoss ?? 0,
    unrealizedPnLPercent: p.unrealizedPnLPercent ?? p.gainLossPercent ?? 0,
    gainLoss: p.gainLoss ?? p.unrealizedPnL ?? 0,
    gainLossPercent: p.gainLossPercent ?? p.unrealizedPnLPercent ?? 0,
  }));

  const totalCost = ticketPrice && ticketQuantity ? ticketPrice * parseInt(ticketQuantity) : 0;
  const cashBalance = portfolio.player.cashBalance ?? portfolio.player.currentCash ?? 0;
  const canAfford = ticketType === 'BUY' ? totalCost <= cashBalance : true;
  const maxBuyQuantity = ticketPrice ? Math.floor(cashBalance / ticketPrice) : 0;

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
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#16202a] rounded-xl border border-[#2f3336] p-5">
            <p className="text-sm text-[#71767b] mb-1">Available Cash</p>
            <p className="text-2xl font-bold text-white">
              ${cashBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-[#16202a] rounded-xl border border-[#2f3336] p-5">
            <p className="text-sm text-[#71767b] mb-1">Portfolio Value</p>
            <p className="text-2xl font-bold text-white">
              ${(portfolio.player.totalValue ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-[#16202a] rounded-xl border border-[#2f3336] p-5">
            <p className="text-sm text-[#71767b] mb-1">Unrealized P&L</p>
            <p className={`text-2xl font-bold ${(portfolio.player.totalUnrealizedPnL ?? portfolio.player.totalGainLoss ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {(portfolio.player.totalUnrealizedPnL ?? portfolio.player.totalGainLoss ?? 0) >= 0 ? '+' : ''}${(portfolio.player.totalUnrealizedPnL ?? portfolio.player.totalGainLoss ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-[#16202a] rounded-xl border border-[#2f3336] p-5">
            <p className="text-sm text-[#71767b] mb-1">Realized P&L</p>
            <p className={`text-2xl font-bold ${(portfolio.player.totalRealizedPnL ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {(portfolio.player.totalRealizedPnL ?? 0) >= 0 ? '+' : ''}${(portfolio.player.totalRealizedPnL ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Trading Ticket */}
        <div className="bg-[#16202a] rounded-xl border border-[#2f3336] p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Trade Any Stock</h2>
          <form onSubmit={handleTicketSubmit} className="space-y-4">
            <div className="grid md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#71767b] mb-2">Symbol</label>
                <input
                  type="text"
                  value={ticketSymbol}
                  onChange={(e) => setTicketSymbol(e.target.value.toUpperCase())}
                  placeholder="e.g., AAPL"
                  className="w-full px-4 py-3 bg-[#1d2a35] border border-[#2f3336] rounded-lg text-white placeholder-[#71767b] focus:outline-none focus:ring-2 focus:ring-[#1d9bf0] uppercase"
                />
                {fetchingPrice && (
                  <p className="text-sm text-[#71767b] mt-1">Fetching price...</p>
                )}
                {ticketPrice && !fetchingPrice && (
                  <p className="text-sm text-emerald-400 mt-1">${ticketPrice.toFixed(2)}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-[#71767b] mb-2">Quantity</label>
                <input
                  type="number"
                  value={ticketQuantity}
                  onChange={(e) => setTicketQuantity(e.target.value)}
                  placeholder="Shares"
                  min="1"
                  className="w-full px-4 py-3 bg-[#1d2a35] border border-[#2f3336] rounded-lg text-white placeholder-[#71767b] focus:outline-none focus:ring-2 focus:ring-[#1d9bf0]"
                />
                {ticketType === 'BUY' && ticketPrice && (
                  <p className="text-sm text-[#71767b] mt-1">Max: {maxBuyQuantity}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-[#71767b] mb-2">Action</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTicketType('BUY')}
                    className={`py-3 px-4 rounded-lg font-semibold transition-all ${
                      ticketType === 'BUY'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#1d2a35] text-[#71767b] hover:bg-[#2f3336]'
                    }`}
                  >
                    Buy
                  </button>
                  <button
                    type="button"
                    onClick={() => setTicketType('SELL')}
                    className={`py-3 px-4 rounded-lg font-semibold transition-all ${
                      ticketType === 'SELL'
                        ? 'bg-red-600 text-white'
                        : 'bg-[#1d2a35] text-[#71767b] hover:bg-[#2f3336]'
                    }`}
                  >
                    Sell
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#71767b] mb-2">Total</label>
                <div className="px-4 py-3 bg-[#1d2a35] border border-[#2f3336] rounded-lg">
                  <p className={`font-semibold ${canAfford ? 'text-white' : 'text-red-400'}`}>
                    ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                {ticketType === 'BUY' && !canAfford && totalCost > 0 && (
                  <p className="text-sm text-red-400 mt-1">Insufficient cash</p>
                )}
              </div>
            </div>
            <button
              type="submit"
              disabled={tradeLoading || !canAfford || !ticketSymbol || !ticketQuantity}
              className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
                ticketType === 'BUY'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              } disabled:bg-[#2f3336] disabled:text-[#71767b] disabled:cursor-not-allowed`}
            >
              {tradeLoading ? 'Processing...' : `${ticketType} Stock`}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <p className="text-emerald-400 text-sm">{success}</p>
            </div>
          )}
        </div>

        {/* Current Holdings with Buy/Sell buttons */}
        <div className="bg-[#16202a] rounded-xl border border-[#2f3336] p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Current Holdings</h2>
          {positions.length > 0 ? (
            <div className="space-y-3">
              {positions.map((pos) => (
                <div key={pos.symbol} className="flex justify-between items-center p-4 bg-[#1d2a35] rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <a
                        href={`https://www.google.com/finance/quote/${pos.symbol}:NASDAQ`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-white text-lg hover:text-[#1d9bf0] transition-colors"
                      >
                        {pos.symbol}
                      </a>
                      <span className="text-[#71767b]">{pos.quantity} shares @ ${pos.currentPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-white font-medium">
                        ${pos.currentValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-[#71767b] text-sm">
                        Cost: ${pos.averageCostBasis.toFixed(2)}/share
                      </span>
                      <span className={`text-sm ${pos.unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {pos.unrealizedPnL >= 0 ? '+' : ''}${pos.unrealizedPnL.toFixed(2)} ({pos.unrealizedPnL >= 0 ? '+' : ''}{pos.unrealizedPnLPercent.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleQuickTrade(pos.symbol, 'BUY')}
                      disabled={tradeLoading}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      Buy
                    </button>
                    <button
                      onClick={() => handleQuickTrade(pos.symbol, 'SELL', pos.quantity)}
                      disabled={tradeLoading}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      Sell
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-[#71767b]">
              <p>No positions held. Use the trading ticket above to buy stocks.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
