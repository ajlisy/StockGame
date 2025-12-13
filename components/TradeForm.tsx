'use client';

import React, { useState, useEffect } from 'react';

interface TradeFormProps {
  playerId: string;
  currentCash: number;
  currentPositions: Array<{ symbol: string; quantity: number }>;
  onTradeSuccess: () => void;
}

export default function TradeForm({ playerId, currentCash, currentPositions, onTradeSuccess }: TradeFormProps) {
  const [symbol, setSymbol] = useState('');
  const [type, setType] = useState<'BUY' | 'SELL'>('BUY');
  const [quantity, setQuantity] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [fetchingPrice, setFetchingPrice] = useState(false);

  const currentStock = currentPositions.length > 0 ? currentPositions[0].symbol : null;
  const canBuyNewStock = currentPositions.length === 0;

  useEffect(() => {
    if (type === 'SELL' && currentStock) {
      setSymbol(currentStock);
    } else {
      setSymbol('');
    }
  }, [type, currentStock]);

  const fetchPrice = async () => {
    if (!symbol) return;

    setFetchingPrice(true);
    setError('');
    try {
      const response = await fetch(`/api/stocks?symbol=${symbol}`);
      const data = await response.json();
      if (data.price) {
        setCurrentPrice(data.price);
      } else {
        setError('Could not fetch stock price');
        setCurrentPrice(null);
      }
    } catch (err) {
      setError('Error fetching stock price');
      setCurrentPrice(null);
    } finally {
      setFetchingPrice(false);
    }
  };

  useEffect(() => {
    if (symbol && symbol.length >= 1) {
      const timeoutId = setTimeout(() => {
        fetchPrice();
      }, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setCurrentPrice(null);
    }
  }, [symbol]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const qty = parseInt(quantity);
      if (!qty || qty <= 0) {
        setError('Please enter a valid quantity');
        setLoading(false);
        return;
      }

      if (!symbol) {
        setError('Please enter a stock symbol');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/trades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbol: symbol.toUpperCase(),
          type,
          quantity: qty,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Trade failed');
        setLoading(false);
        return;
      }

      // Success
      setSuccess(`Successfully ${type === 'BUY' ? 'bought' : 'sold'} ${qty} shares of ${symbol.toUpperCase()}`);
      setSymbol('');
      setQuantity('');
      setCurrentPrice(null);
      onTradeSuccess();
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const totalCost = currentPrice && quantity ? currentPrice * parseInt(quantity) : 0;
  const canAfford = type === 'BUY' ? totalCost <= currentCash : true;
  const maxQuantity = type === 'BUY' && currentPrice
    ? Math.floor(currentCash / currentPrice)
    : currentPositions.length > 0
    ? currentPositions[0].quantity
    : 0;

  return (
    <div className="bg-[#16202a] rounded-xl border border-[#2f3336] overflow-hidden">
      <div className="px-6 py-4 border-b border-[#2f3336] bg-[#1d2a35]">
        <h2 className="text-xl font-bold text-white">Make a Trade</h2>
      </div>

      <div className="p-6">
        {currentStock && (
          <div className="mb-6 p-4 bg-[#1d9bf0]/10 border border-[#1d9bf0]/20 rounded-lg">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-[#1d9bf0] mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm text-[#1d9bf0] font-medium">
                  Current holding: {currentStock} ({currentPositions[0].quantity} shares)
                </p>
                <p className="text-sm text-[#71767b] mt-1">
                  You must sell {currentStock} before buying a different stock.
                </p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-[#71767b] mb-3">
              Transaction Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType('BUY')}
                className={`py-3 px-4 rounded-lg font-semibold transition-all ${
                  type === 'BUY'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#1d2a35] text-[#71767b] hover:bg-[#2f3336]'
                }`}
              >
                Buy
              </button>
              <button
                type="button"
                onClick={() => setType('SELL')}
                disabled={currentPositions.length === 0}
                className={`py-3 px-4 rounded-lg font-semibold transition-all ${
                  type === 'SELL'
                    ? 'bg-red-600 text-white'
                    : 'bg-[#1d2a35] text-[#71767b] hover:bg-[#2f3336]'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Sell {currentPositions.length === 0 && '(No positions)'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#71767b] mb-2">
              Stock Symbol
            </label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="e.g., AAPL"
              className="w-full px-4 py-3 bg-[#1d2a35] border border-[#2f3336] rounded-lg text-white placeholder-[#71767b] focus:outline-none focus:ring-2 focus:ring-[#1d9bf0] focus:border-transparent transition-all uppercase"
              disabled={type === 'SELL' && currentStock !== null}
              required
            />
            {fetchingPrice && (
              <p className="text-sm text-[#71767b] mt-2 flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Fetching price...
              </p>
            )}
            {currentPrice && !fetchingPrice && (
              <p className="text-sm text-emerald-400 mt-2">
                Current price: ${currentPrice.toFixed(2)}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[#71767b] mb-2">
              Quantity
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Number of shares"
              min="1"
              className="w-full px-4 py-3 bg-[#1d2a35] border border-[#2f3336] rounded-lg text-white placeholder-[#71767b] focus:outline-none focus:ring-2 focus:ring-[#1d9bf0] focus:border-transparent transition-all"
              required
            />
            {maxQuantity > 0 && (
              <div className="flex justify-between items-center mt-2">
                <p className="text-sm text-[#71767b]">
                  Max: {maxQuantity.toLocaleString()} shares
                </p>
                <button
                  type="button"
                  onClick={() => setQuantity(maxQuantity.toString())}
                  className="text-sm text-[#1d9bf0] hover:text-[#1a8cd8] transition-colors"
                >
                  Use Max
                </button>
              </div>
            )}
          </div>

          {currentPrice && quantity && (
            <div className="p-4 bg-[#1d2a35] rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#71767b]">Price per share</span>
                <span className="text-white">${currentPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#71767b]">Quantity</span>
                <span className="text-white">{parseInt(quantity).toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-semibold pt-2 border-t border-[#2f3336]">
                <span className="text-white">Total {type === 'BUY' ? 'Cost' : 'Proceeds'}</span>
                <span className={canAfford ? 'text-white' : 'text-red-400'}>
                  ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              {type === 'BUY' && !canAfford && (
                <p className="text-sm text-red-400 pt-2">
                  Insufficient cash. Available: ${currentCash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <p className="text-emerald-400 text-sm">{success}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !canAfford || (type === 'BUY' && !canBuyNewStock && symbol !== currentStock)}
            className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
              type === 'BUY'
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            } disabled:bg-[#2f3336] disabled:text-[#71767b] disabled:cursor-not-allowed`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </span>
            ) : (
              `${type} Stock`
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
