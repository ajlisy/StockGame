import fs from 'fs';
import path from 'path';

// For serverless environments, use /tmp for writable storage
// For local development, use data/ directory
const DATA_DIR = process.env.AWS_LAMBDA_FUNCTION_NAME 
  ? '/tmp/data'
  : path.join(process.cwd(), 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface Player {
  id: string;
  name: string;
  passwordHash: string;
  startingCash: number;
  currentCash: number;
  createdAt: string;
}

export interface Position {
  id: string;
  playerId: string;
  symbol: string;
  quantity: number;
  purchasePrice: number;
  purchaseDate: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  playerId: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  totalAmount: number;
  date: string;
}

export interface StockPrice {
  symbol: string;
  price: number;
  lastUpdated: string;
}

export interface InitialPosition {
  playerId: string;
  symbol: string;
  quantity: number;
  purchasePrice: number;
  purchaseDate: string;
}

export interface PortfolioSnapshot {
  playerId: string;
  date: string; // YYYY-MM-DD
  totalValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
}

class Database {
  private getFilePath(file: string): string {
    return path.join(DATA_DIR, `${file}.json`);
  }

  private readFile<T>(file: string, defaultValue: T): T {
    const filePath = this.getFilePath(file);
    if (!fs.existsSync(filePath)) {
      return defaultValue;
    }
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error reading ${file}:`, error);
      return defaultValue;
    }
  }

  private writeFile<T>(file: string, data: T): void {
    const filePath = this.getFilePath(file);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  // Players
  getPlayers(): Player[] {
    return this.readFile<Player[]>('players', []);
  }

  getPlayer(id: string): Player | null {
    const players = this.getPlayers();
    return players.find(p => p.id === id) || null;
  }

  getPlayerByName(name: string): Player | null {
    const players = this.getPlayers();
    return players.find(p => p.name.toLowerCase() === name.toLowerCase()) || null;
  }

  savePlayer(player: Player): void {
    const players = this.getPlayers();
    const index = players.findIndex(p => p.id === player.id);
    if (index >= 0) {
      players[index] = player;
    } else {
      players.push(player);
    }
    this.writeFile('players', players);
  }

  // Positions
  getPositions(): Position[] {
    return this.readFile<Position[]>('positions', []);
  }

  getPlayerPositions(playerId: string): Position[] {
    const positions = this.getPositions();
    return positions.filter(p => p.playerId === playerId);
  }

  savePosition(position: Position): void {
    const positions = this.getPositions();
    const index = positions.findIndex(p => p.id === position.id);
    if (index >= 0) {
      positions[index] = position;
    } else {
      positions.push(position);
    }
    this.writeFile('positions', positions);
  }

  deletePosition(positionId: string): void {
    const positions = this.getPositions();
    const filtered = positions.filter(p => p.id !== positionId);
    this.writeFile('positions', filtered);
  }

  // Transactions
  getTransactions(): Transaction[] {
    return this.readFile<Transaction[]>('transactions', []);
  }

  getPlayerTransactions(playerId: string): Transaction[] {
    const transactions = this.getTransactions();
    return transactions.filter(t => t.playerId === playerId);
  }

  saveTransaction(transaction: Transaction): void {
    const transactions = this.getTransactions();
    transactions.push(transaction);
    this.writeFile('transactions', transactions);
  }

  // Stock Prices
  getStockPrices(): Record<string, StockPrice> {
    return this.readFile<Record<string, StockPrice>>('stockPrices', {});
  }

  getStockPrice(symbol: string): number | null {
    const prices = this.getStockPrices();
    return prices[symbol]?.price || null;
  }

  saveStockPrice(symbol: string, price: number): void {
    const prices = this.getStockPrices();
    prices[symbol] = {
      symbol,
      price,
      lastUpdated: new Date().toISOString(),
    };
    this.writeFile('stockPrices', prices);
  }

  saveStockPrices(prices: Record<string, StockPrice>): void {
    this.writeFile('stockPrices', prices);
  }

  // Initial Positions (for P&L tracking based on starting positions)
  getInitialPositions(): InitialPosition[] {
    return this.readFile<InitialPosition[]>('initialPositions', []);
  }

  getPlayerInitialPositions(playerId: string): InitialPosition[] {
    const positions = this.getInitialPositions();
    return positions.filter(p => p.playerId === playerId);
  }

  saveInitialPosition(position: InitialPosition): void {
    const positions = this.getInitialPositions();
    // Remove any existing initial position for this player/symbol
    const filtered = positions.filter(
      p => !(p.playerId === position.playerId && p.symbol === position.symbol)
    );
    filtered.push(position);
    this.writeFile('initialPositions', filtered);
  }

  clearPlayerInitialPositions(playerId: string): void {
    const positions = this.getInitialPositions();
    const filtered = positions.filter(p => p.playerId !== playerId);
    this.writeFile('initialPositions', filtered);
  }

  // Portfolio Snapshots (for historical value tracking)
  getPortfolioSnapshots(): PortfolioSnapshot[] {
    return this.readFile<PortfolioSnapshot[]>('portfolioSnapshots', []);
  }

  getPlayerSnapshots(playerId: string): PortfolioSnapshot[] {
    const snapshots = this.getPortfolioSnapshots();
    return snapshots.filter(s => s.playerId === playerId).sort((a, b) => a.date.localeCompare(b.date));
  }

  savePortfolioSnapshot(snapshot: PortfolioSnapshot): void {
    const snapshots = this.getPortfolioSnapshots();
    // Remove any existing snapshot for this player/date
    const filtered = snapshots.filter(
      s => !(s.playerId === snapshot.playerId && s.date === snapshot.date)
    );
    filtered.push(snapshot);
    this.writeFile('portfolioSnapshots', filtered);
  }
}

export const db = new Database();

