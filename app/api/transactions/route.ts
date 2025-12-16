import { NextRequest, NextResponse } from 'next/server';
import { db, LedgerEntry } from '@/lib/db';

// Convert ledger entry to transaction format for backwards compatibility
function ledgerEntryToTransaction(entry: LedgerEntry) {
  return {
    id: entry.id,
    playerId: entry.playerId,
    symbol: entry.symbol || '',
    type: entry.entryType === 'BUY' ? 'BUY' : entry.entryType === 'SELL' ? 'SELL' : entry.entryType,
    quantity: Math.abs(entry.quantity),
    price: entry.pricePerShare,
    totalAmount: Math.abs(entry.cashChange),
    date: entry.timestamp,
    // New fields from ledger
    entryType: entry.entryType,
    cashChange: entry.cashChange,
    costBasisPerShare: entry.costBasisPerShare,
    realizedPnL: entry.realizedPnL,
    notes: entry.notes,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const playerId = searchParams.get('playerId');
    const type = searchParams.get('type'); // Optional: filter by BUY, SELL, or CASH_DEPOSIT

    let entries: LedgerEntry[];

    if (playerId) {
      entries = await db.getPlayerLedgerEntries(playerId);
    } else {
      entries = await db.getLedgerEntries();
    }

    // Filter by type if specified
    if (type) {
      entries = entries.filter(e => e.entryType === type);
    } else {
      // By default, only show BUY and SELL (trades), not cash deposits
      entries = entries.filter(e => e.entryType === 'BUY' || e.entryType === 'SELL');
    }

    // Sort by timestamp descending (most recent first)
    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Convert to transaction format
    const transactions = entries.map(ledgerEntryToTransaction);

    return NextResponse.json({ transactions });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
