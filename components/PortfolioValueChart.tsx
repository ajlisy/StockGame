'use client';

import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';

interface Snapshot {
  date: string;
  totalValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
}

interface PortfolioValueChartProps {
  playerId: string;
  startingCash: number;
}

export default function PortfolioValueChart({ playerId, startingCash }: PortfolioValueChartProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');

  useEffect(() => {
    fetchHistory();
  }, [playerId]);

  const fetchHistory = async () => {
    try {
      const response = await fetch(`/api/portfolio/history?playerId=${playerId}`);
      const data = await response.json();

      if (data.snapshots && data.snapshots.length > 0) {
        setSnapshots(data.snapshots);
      }
    } catch (error) {
      console.error('Error fetching portfolio history:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-32 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (snapshots.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-[#71767b] text-sm">
        Not enough data to display chart
      </div>
    );
  }

  // Format data for chart
  const chartData = snapshots.map((snapshot) => ({
    date: new Date(snapshot.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    value: snapshot.totalValue,
    fullDate: snapshot.date,
  }));

  // Calculate daily changes for table
  const tableData = snapshots.map((snapshot, index) => {
    const prevValue = index > 0 ? snapshots[index - 1].totalValue : startingCash;
    const dailyChange = snapshot.totalValue - prevValue;
    const dailyChangePercent = prevValue !== 0 ? (dailyChange / prevValue) * 100 : 0;

    return {
      date: new Date(snapshot.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      fullDate: snapshot.date,
      totalValue: snapshot.totalValue,
      totalGainLoss: snapshot.totalGainLoss,
      totalGainLossPercent: snapshot.totalGainLossPercent,
      dailyChange,
      dailyChangePercent,
    };
  }).reverse(); // Most recent first

  const isPositive = snapshots[snapshots.length - 1]?.totalGainLoss >= 0;
  const lineColor = isPositive ? '#10b981' : '#ef4444';

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-[#71767b] uppercase tracking-wider">
          Portfolio Value History
        </h4>
        <div className="flex gap-1 bg-[#2f3336] rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('chart')}
            className={`px-2 py-1 text-xs rounded-md transition-colors ${
              viewMode === 'chart'
                ? 'bg-[#16202a] text-white'
                : 'text-[#71767b] hover:text-white'
            }`}
          >
            Chart
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-2 py-1 text-xs rounded-md transition-colors ${
              viewMode === 'table'
                ? 'bg-[#16202a] text-white'
                : 'text-[#71767b] hover:text-white'
            }`}
          >
            Table
          </button>
        </div>
      </div>

      {viewMode === 'chart' ? (
        <ResponsiveContainer width="100%" height={120}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2f3336" />
            <XAxis
              dataKey="date"
              stroke="#71767b"
              style={{ fontSize: '11px' }}
              tick={{ fill: '#71767b' }}
            />
            <YAxis
              stroke="#71767b"
              style={{ fontSize: '11px' }}
              tick={{ fill: '#71767b' }}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#16202a',
                border: '1px solid #2f3336',
                borderRadius: '8px',
                color: '#e7e9ea',
              }}
              labelStyle={{ color: '#71767b' }}
              formatter={(value: number) => [
                `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                'Value',
              ]}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={lineColor}
              strokeWidth={2}
              dot={{ fill: lineColor, r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="max-h-48 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#16202a]">
              <tr className="text-[#71767b] text-xs uppercase">
                <th className="text-left py-2 pr-2">Date</th>
                <th className="text-right py-2 px-2">Value</th>
                <th className="text-right py-2 px-2">Daily P&L</th>
                <th className="text-right py-2 pl-2">Total P&L</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((row) => {
                const dailyIsPositive = row.dailyChange >= 0;
                const totalIsPositive = row.totalGainLoss >= 0;
                return (
                  <tr key={row.fullDate} className="border-t border-[#2f3336]">
                    <td className="py-2 pr-2 text-white">{row.date}</td>
                    <td className="py-2 px-2 text-right text-white">
                      ${row.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className={`py-2 px-2 text-right ${dailyIsPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {dailyIsPositive ? '+' : ''}${row.dailyChange.toFixed(2)}
                      <span className="text-xs ml-1">
                        ({dailyIsPositive ? '+' : ''}{row.dailyChangePercent.toFixed(2)}%)
                      </span>
                    </td>
                    <td className={`py-2 pl-2 text-right ${totalIsPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {totalIsPositive ? '+' : ''}${row.totalGainLoss.toFixed(2)}
                      <span className="text-xs ml-1">
                        ({totalIsPositive ? '+' : ''}{row.totalGainLossPercent.toFixed(2)}%)
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
