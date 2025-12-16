'use client';

import React from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface StockChartProps {
  data: Array<{ date: string; price: number }>;
  isPositive: boolean;
  height?: number;
  costBasis?: number;  // If provided, y-axis will be +/-20% from this price
}

export default function StockChart({ data, isPositive, height = 80, costBasis }: StockChartProps) {
  const color = isPositive ? '#10b981' : '#ef4444';
  const gradientId = `gradient-${Math.random().toString(36).substr(2, 9)}`;

  // Calculate y-axis domain based on cost basis (+/- 20%)
  const yDomain: [number | string, number | string] = costBasis
    ? [costBasis * 0.8, costBasis * 1.2]
    : ['dataMin - 1', 'dataMax + 1'];

  if (!data || data.length === 0) {
    return (
      <div className="h-20 flex items-center justify-center text-muted-foreground text-sm">
        No chart data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="date" hide />
        <YAxis hide domain={yDomain} />
        <Tooltip
          contentStyle={{
            backgroundColor: '#16202a',
            border: '1px solid #2f3336',
            borderRadius: '8px',
            color: '#e7e9ea',
          }}
          labelStyle={{ color: '#71767b' }}
          formatter={(value: number) => [`$${value.toFixed(2)}`, 'Price']}
        />
        <Area
          type="monotone"
          dataKey="price"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
