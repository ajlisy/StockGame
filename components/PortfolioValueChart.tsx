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

  useEffect(() => {
    fetchHistory();
  }, [playerId]);

  const fetchHistory = async () => {
    try {
      const response = await fetch(`/api/portfolio/history?playerId=${playerId}`);
      const data = await response.json();

      if (data.snapshots) {
        // Add starting point (Dec 7) if not present
        const hasStartingPoint = data.snapshots.some((s: Snapshot) => s.date === '2024-12-07');

        const allSnapshots = hasStartingPoint
          ? data.snapshots
          : [
              {
                date: '2024-12-07',
                totalValue: startingCash,
                totalGainLoss: 0,
                totalGainLossPercent: 0,
              },
              ...data.snapshots,
            ];

        setSnapshots(allSnapshots);
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

  const isPositive = snapshots[snapshots.length - 1]?.totalGainLoss >= 0;
  const lineColor = isPositive ? '#10b981' : '#ef4444';

  return (
    <div>
      <h4 className="text-sm font-semibold text-[#71767b] uppercase tracking-wider mb-3">
        Portfolio Value Since Dec 7th
      </h4>
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
    </div>
  );
}
