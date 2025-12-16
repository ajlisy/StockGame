import { db, LedgerEntry, PositionSummary, PlayerSummary } from './db';

// Generate unique ID based on timestamp
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Recalculate position summary from ledger entries
export async function recalculatePositionSummary(
  playerId: string,
  symbol: string
): Promise<PositionSummary | null> {
  const entries = await db.getLedgerEntriesForSymbol(playerId, symbol);

  if (entries.length === 0) {
    await db.deletePositionSummary(playerId, symbol);
    return null;
  }

  let totalShares = 0;
  let totalCost = 0;
  let firstPurchaseDate: string | null = null;
  let lastActivityDate = '';

  for (const entry of entries) {
    if (entry.entryType === 'BUY') {
      // Add to position
      totalCost += entry.quantity * entry.pricePerShare;
      totalShares += entry.quantity;
      if (!firstPurchaseDate) {
        firstPurchaseDate = entry.timestamp.split('T')[0];
      }
    } else if (entry.entryType === 'SELL') {
      // Reduce position - cost basis per share stays the same
      const sharesSold = Math.abs(entry.quantity);
      const avgCost = totalShares > 0 ? totalCost / totalShares : 0;
      totalCost -= avgCost * sharesSold;
      totalShares -= sharesSold;
    }
    lastActivityDate = entry.timestamp.split('T')[0];
  }

  // If no shares left, delete the position summary
  if (totalShares <= 0) {
    await db.deletePositionSummary(playerId, symbol);
    return null;
  }

  const summary: PositionSummary = {
    playerId,
    symbol,
    quantity: totalShares,
    averageCostBasis: totalCost / totalShares,
    totalCostBasis: totalCost,
    firstPurchaseDate: firstPurchaseDate!,
    lastActivityDate,
  };

  await db.savePositionSummary(summary);
  return summary;
}

// Recalculate player summary from ledger entries
export async function recalculatePlayerSummary(playerId: string): Promise<PlayerSummary> {
  const entries = await db.getPlayerLedgerEntries(playerId);

  let cashBalance = 0;
  let totalDeposited = 0;
  let totalRealizedPnL = 0;

  for (const entry of entries) {
    cashBalance += entry.cashChange;

    if (entry.entryType === 'CASH_DEPOSIT') {
      totalDeposited += entry.cashChange;
    }

    // For initial stock positions (BUY with cashChange: 0), count the cost basis as deposited
    // These are positions imported from CSV that represent initial portfolio value
    if (entry.entryType === 'BUY' && entry.cashChange === 0) {
      totalDeposited += entry.quantity * entry.pricePerShare;
    }

    if (entry.realizedPnL !== null) {
      totalRealizedPnL += entry.realizedPnL;
    }
  }

  const summary: PlayerSummary = {
    playerId,
    cashBalance,
    totalDeposited,
    totalRealizedPnL,
    lastUpdated: new Date().toISOString(),
  };

  await db.savePlayerSummary(summary);
  return summary;
}

// Get current average cost basis for a position
export async function getCurrentAverageCostBasis(
  playerId: string,
  symbol: string
): Promise<number | null> {
  const summary = await db.getPositionSummary(playerId, symbol);
  return summary?.averageCostBasis ?? null;
}

// Get current position quantity
export async function getCurrentPositionQuantity(
  playerId: string,
  symbol: string
): Promise<number> {
  const summary = await db.getPositionSummary(playerId, symbol);
  return summary?.quantity ?? 0;
}

// Get current cash balance
export async function getCurrentCashBalance(playerId: string): Promise<number> {
  const summary = await db.getPlayerSummary(playerId);
  return summary?.cashBalance ?? 0;
}

export interface TradeValidation {
  valid: boolean;
  error?: string;
  playerSummary?: PlayerSummary | null;
  positionSummary?: PositionSummary | null;
}

// Validate a trade before execution
export async function validateTrade(
  playerId: string,
  symbol: string,
  type: 'BUY' | 'SELL',
  quantity: number,
  price: number
): Promise<TradeValidation> {
  // Basic validation
  if (quantity <= 0 || !Number.isInteger(quantity)) {
    return { valid: false, error: 'Quantity must be a positive integer' };
  }
  if (price <= 0) {
    return { valid: false, error: 'Price must be positive' };
  }

  // Get current state
  const playerSummary = await db.getPlayerSummary(playerId);
  const positionSummary = await db.getPositionSummary(playerId, symbol);

  if (type === 'BUY') {
    const totalCost = quantity * price;
    const cashBalance = playerSummary?.cashBalance ?? 0;
    if (totalCost > cashBalance) {
      return {
        valid: false,
        error: `Insufficient cash. Available: $${cashBalance.toFixed(2)}, Required: $${totalCost.toFixed(2)}`,
        playerSummary,
        positionSummary
      };
    }
  } else {
    // SELL
    const currentQuantity = positionSummary?.quantity ?? 0;
    if (currentQuantity < quantity) {
      return {
        valid: false,
        error: `Insufficient shares. You own ${currentQuantity} shares of ${symbol}`,
        playerSummary,
        positionSummary
      };
    }
  }

  return { valid: true, playerSummary, positionSummary };
}

export interface TradeResult {
  success: boolean;
  error?: string;
  ledgerEntry?: LedgerEntry;
  playerSummary?: PlayerSummary;
  positionSummary?: PositionSummary | null;
}

// Execute a trade
export async function executeTrade(
  playerId: string,
  symbol: string,
  type: 'BUY' | 'SELL',
  quantity: number,
  price: number
): Promise<TradeResult> {
  // Validate
  const validation = await validateTrade(playerId, symbol, type, quantity, price);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Calculate values
  const totalAmount = quantity * price;
  let costBasisPerShare: number | null = null;
  let realizedPnL: number | null = null;

  if (type === 'SELL' && validation.positionSummary) {
    costBasisPerShare = validation.positionSummary.averageCostBasis;
    realizedPnL = (price - costBasisPerShare) * quantity;
  }

  // Create ledger entry
  const entry: LedgerEntry = {
    id: generateId(),
    playerId,
    entryType: type,
    symbol,
    quantity: type === 'BUY' ? quantity : -quantity,
    pricePerShare: price,
    cashChange: type === 'BUY' ? -totalAmount : totalAmount,
    costBasisPerShare,
    realizedPnL,
    timestamp: new Date().toISOString(),
    notes: null,
  };

  // Save ledger entry
  await db.saveLedgerEntry(entry);

  // Recalculate summaries
  const positionSummary = await recalculatePositionSummary(playerId, symbol);
  const playerSummary = await recalculatePlayerSummary(playerId);

  return {
    success: true,
    ledgerEntry: entry,
    playerSummary,
    positionSummary,
  };
}

// Create a cash deposit entry (used for initial imports)
export async function createCashDeposit(
  playerId: string,
  amount: number,
  notes?: string
): Promise<LedgerEntry> {
  const entry: LedgerEntry = {
    id: generateId(),
    playerId,
    entryType: 'CASH_DEPOSIT',
    symbol: null,
    quantity: 0,
    pricePerShare: 0,
    cashChange: amount,
    costBasisPerShare: null,
    realizedPnL: null,
    timestamp: new Date().toISOString(),
    notes: notes || null,
  };

  await db.saveLedgerEntry(entry);
  await recalculatePlayerSummary(playerId);

  return entry;
}

// Create a buy entry for initial imports (doesn't affect cash)
export async function createInitialPosition(
  playerId: string,
  symbol: string,
  quantity: number,
  purchasePrice: number,
  purchaseDate: string,
  notes?: string
): Promise<LedgerEntry> {
  const entry: LedgerEntry = {
    id: generateId(),
    playerId,
    entryType: 'BUY',
    symbol,
    quantity,
    pricePerShare: purchasePrice,
    cashChange: 0, // Initial imports don't affect cash (it's already accounted for in CASH_DEPOSIT)
    costBasisPerShare: null,
    realizedPnL: null,
    timestamp: new Date(purchaseDate).toISOString(),
    notes: notes || 'Initial import from CSV',
  };

  await db.saveLedgerEntry(entry);
  await recalculatePositionSummary(playerId, symbol);

  return entry;
}

// Clear all ledger data for a player (used for re-imports)
export async function clearPlayerLedgerData(playerId: string): Promise<void> {
  await db.clearPlayerLedgerEntries(playerId);
  await db.clearPlayerPositionSummaries(playerId);
  await db.deletePlayerSummary(playerId);
}
