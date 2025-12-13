'use client';

import React from 'react';

interface StockTableProps {
  portfolios: Array<{
    player: {
      name: string;
    };
    positions: Array<{
      symbol: string;
      quantity: number;
      purchasePrice: number;
      currentPrice: number;
      gainLoss: number;
      gainLossPercent: number;
    }>;
  }>;
}

export default function StockTable({ portfolios }: StockTableProps) {
  // Get all unique stocks
  const allStocks = new Set<string>();
  portfolios.forEach(p => {
    p.positions.forEach(pos => allStocks.add(pos.symbol));
  });

  const stockArray = Array.from(allStocks);

  if (stockArray.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Stock Performance</h2>
        <p className="text-gray-500">No stocks currently held</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Stock Performance</h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Stock</th>
              {portfolios.map(p => (
                <th key={p.player.name} className="text-right py-3 px-4 font-semibold text-gray-700">
                  {p.player.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stockArray.map(symbol => {
              const playerData = portfolios.map(p => {
                const position = p.positions.find(pos => pos.symbol === symbol);
                return position || null;
              });

              return (
                <tr key={symbol} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 font-semibold text-gray-800">{symbol}</td>
                  {playerData.map((data, idx) => (
                    <td key={idx} className="text-right py-3 px-4">
                      {data ? (
                        <div>
                          <div className="font-medium text-gray-800">
                            {data.quantity} @ ${(data.currentPrice || 0).toFixed(2)}
                          </div>
                          <div className={`text-sm ${data.gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {data.gainLoss >= 0 ? '+' : ''}${(data.gainLoss || 0).toFixed(2)} ({data.gainLossPercent >= 0 ? '+' : ''}{(data.gainLossPercent != null ? data.gainLossPercent : 0).toFixed(2)}%)
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

