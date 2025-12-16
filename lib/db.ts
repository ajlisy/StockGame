import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import fs from 'fs';
import path from 'path';

// Use functions to check at runtime, not module load time
function useDynamoDB(): boolean {
  return !!(process.env.AWS_REGION && process.env.DYNAMODB_TABLE_NAME);
}

function getTableName(): string {
  return process.env.DYNAMODB_TABLE_NAME || 'stock-competition';
}

function getRegion(): string {
  return process.env.AWS_REGION || 'us-east-1';
}

// Lazy initialization of DynamoDB client
let dynamoClient: DynamoDBDocumentClient | null = null;
function getDynamoClient(): DynamoDBDocumentClient | null {
  if (!useDynamoDB()) return null;
  if (!dynamoClient) {
    const client = new DynamoDBClient({ region: getRegion() });
    dynamoClient = DynamoDBDocumentClient.from(client);
    console.log(`[DB] Initialized DynamoDB client for region: ${getRegion()}, table: ${getTableName()}`);
  }
  return dynamoClient;
}

// File system fallback for local development - lazy init
let dataDir: string | null = null;
function getDataDir(): string {
  if (!dataDir) {
    // On AWS Lambda, use /tmp/data (only writable directory)
    // Locally, use ./data in project root
    const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
    dataDir = isLambda ? '/tmp/data' : path.join(process.cwd(), 'data');
    if (!useDynamoDB() && !fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }
  return dataDir;
}

export interface Player {
  id: string;
  name: string;
  passwordHash: string;
  createdAt: string;
}

// Central Ledger Entry - immutable record of all financial events
export interface LedgerEntry {
  id: string;
  playerId: string;
  entryType: 'CASH_DEPOSIT' | 'BUY' | 'SELL';
  symbol: string | null;                // null for cash-only entries
  quantity: number;                     // shares (positive for buys, negative for sells)
  pricePerShare: number;
  cashChange: number;                   // positive = cash in, negative = cash out
  costBasisPerShare: number | null;     // avg cost at time of entry (for sells)
  realizedPnL: number | null;           // calculated at sell time
  timestamp: string;
  notes: string | null;
}

// Derived/cached position state per player+symbol
export interface PositionSummary {
  playerId: string;
  symbol: string;
  quantity: number;                     // current shares held
  averageCostBasis: number;             // weighted avg cost per share
  totalCostBasis: number;               // quantity * averageCostBasis
  firstPurchaseDate: string;
  lastActivityDate: string;
}

// Derived/cached player state
export interface PlayerSummary {
  playerId: string;
  cashBalance: number;                  // sum of all cashChange entries
  totalDeposited: number;               // sum of CASH_DEPOSIT entries
  totalRealizedPnL: number;             // sum of all realizedPnL from sells
  lastUpdated: string;
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

export interface NewsCache {
  playerId: string;
  weekSummary: string;
  weekBullets: string[];
  todaySummary: string;
  todayBullets: string[];
  cachedAt: string; // ISO timestamp when cache was created
}

class Database {
  // DynamoDB methods
  private async dynamoGet<T>(pk: string, sk: string): Promise<T | null> {
    const client = getDynamoClient();
    if (!client) return null;
    try {
      const result = await client.send(
        new GetCommand({
          TableName: getTableName(),
          Key: { pk, sk },
        })
      );
      return result.Item ? (result.Item.data as T) : null;
    } catch (error) {
      console.error('DynamoDB get error:', error);
      return null;
    }
  }

  private async dynamoPut<T>(pk: string, sk: string, data: T): Promise<void> {
    const client = getDynamoClient();
    if (!client) return;
    try {
      await client.send(
        new PutCommand({
          TableName: getTableName(),
          Item: { pk, sk, data },
        })
      );
    } catch (error) {
      console.error('DynamoDB put error:', error);
      throw error;
    }
  }

  private async dynamoQuery<T>(pk: string, skPrefix?: string): Promise<T[]> {
    const client = getDynamoClient();
    if (!client) return [];
    try {
      const params: any = {
        TableName: getTableName(),
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': pk },
      };

      if (skPrefix) {
        params.KeyConditionExpression += ' AND begins_with(sk, :skPrefix)';
        params.ExpressionAttributeValues[':skPrefix'] = skPrefix;
      }

      const result = await client.send(new QueryCommand(params));
      return (result.Items || []).map(item => item.data as T);
    } catch (error) {
      console.error('DynamoDB query error:', error);
      return [];
    }
  }

  private async dynamoScan<T>(pkPrefix: string): Promise<T[]> {
    const client = getDynamoClient();
    if (!client) return [];
    try {
      const result = await client.send(
        new ScanCommand({
          TableName: getTableName(),
          FilterExpression: 'begins_with(pk, :pkPrefix)',
          ExpressionAttributeValues: { ':pkPrefix': pkPrefix },
        })
      );
      return (result.Items || []).map(item => item.data as T);
    } catch (error) {
      console.error('DynamoDB scan error:', error);
      return [];
    }
  }

  private async dynamoDelete(pk: string, sk: string): Promise<void> {
    const client = getDynamoClient();
    if (!client) return;
    try {
      await client.send(
        new DeleteCommand({
          TableName: getTableName(),
          Key: { pk, sk },
        })
      );
    } catch (error) {
      console.error('DynamoDB delete error:', error);
      throw error;
    }
  }

  // File system methods (fallback for local development)
  private getFilePath(file: string): string {
    return path.join(getDataDir(), `${file}.json`);
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
  async getPlayers(): Promise<Player[]> {
    const dynamo = useDynamoDB();
    console.log(`[DB] getPlayers - useDynamoDB: ${dynamo}, AWS_REGION: ${process.env.AWS_REGION}, DYNAMODB_TABLE_NAME: ${process.env.DYNAMODB_TABLE_NAME}`);
    if (dynamo) {
      return this.dynamoQuery<Player>('PLAYER');
    }
    return this.readFile<Player[]>('players', []);
  }

  async getPlayer(id: string): Promise<Player | null> {
    if (useDynamoDB()) {
      return this.dynamoGet<Player>('PLAYER', id);
    }
    const players = await this.getPlayers();
    return players.find(p => p.id === id) || null;
  }

  async getPlayerByName(name: string): Promise<Player | null> {
    if (useDynamoDB()) {
      const players = await this.getPlayers();
      return players.find(p => p.name.toLowerCase() === name.toLowerCase()) || null;
    }
    const players = await this.getPlayers();
    return players.find(p => p.name.toLowerCase() === name.toLowerCase()) || null;
  }

  async savePlayer(player: Player): Promise<void> {
    const dynamo = useDynamoDB();
    console.log(`[DB] savePlayer - useDynamoDB: ${dynamo}, player: ${player.name}`);
    if (dynamo) {
      console.log(`[DB] savePlayer - Writing to DynamoDB: pk=PLAYER, sk=${player.id}`);
      await this.dynamoPut('PLAYER', player.id, player);
      return;
    }
    console.log(`[DB] savePlayer - Writing to file system`);
    const players = await this.getPlayers();
    const index = players.findIndex(p => p.id === player.id);
    if (index >= 0) {
      players[index] = player;
    } else {
      players.push(player);
    }
    this.writeFile('players', players);
  }

  // Positions
  async getPositions(): Promise<Position[]> {
    if (useDynamoDB()) {
      return this.dynamoQuery<Position>('POSITION');
    }
    return this.readFile<Position[]>('positions', []);
  }

  async getPlayerPositions(playerId: string): Promise<Position[]> {
    if (useDynamoDB()) {
      return this.dynamoQuery<Position>('POSITION', `PLAYER#${playerId}#`);
    }
    const positions = await this.getPositions();
    return positions.filter(p => p.playerId === playerId);
  }

  async savePosition(position: Position): Promise<void> {
    const dynamo = useDynamoDB();
    console.log(`[DB] savePosition - useDynamoDB: ${dynamo}, symbol: ${position.symbol}`);
    if (dynamo) {
      console.log(`[DB] savePosition - Writing to DynamoDB: pk=POSITION, sk=PLAYER#${position.playerId}#${position.id}`);
      await this.dynamoPut('POSITION', `PLAYER#${position.playerId}#${position.id}`, position);
      return;
    }
    console.log(`[DB] savePosition - Writing to file system`);
    const positions = await this.getPositions();
    const index = positions.findIndex(p => p.id === position.id);
    if (index >= 0) {
      positions[index] = position;
    } else {
      positions.push(position);
    }
    this.writeFile('positions', positions);
  }

  async deletePosition(positionId: string): Promise<void> {
    if (useDynamoDB()) {
      // Need to find the position first to get playerId
      const positions = await this.getPositions();
      const position = positions.find(p => p.id === positionId);
      if (position) {
        await this.dynamoDelete('POSITION', `PLAYER#${position.playerId}#${positionId}`);
      }
      return;
    }
    const positions = await this.getPositions();
    const filtered = positions.filter(p => p.id !== positionId);
    this.writeFile('positions', filtered);
  }

  // Transactions
  async getTransactions(): Promise<Transaction[]> {
    if (useDynamoDB()) {
      return this.dynamoQuery<Transaction>('TRANSACTION');
    }
    return this.readFile<Transaction[]>('transactions', []);
  }

  async getPlayerTransactions(playerId: string): Promise<Transaction[]> {
    if (useDynamoDB()) {
      return this.dynamoQuery<Transaction>('TRANSACTION', `PLAYER#${playerId}#`);
    }
    const transactions = await this.getTransactions();
    return transactions.filter(t => t.playerId === playerId);
  }

  async saveTransaction(transaction: Transaction): Promise<void> {
    if (useDynamoDB()) {
      await this.dynamoPut('TRANSACTION', `PLAYER#${transaction.playerId}#${transaction.id}`, transaction);
      return;
    }
    const transactions = await this.getTransactions();
    transactions.push(transaction);
    this.writeFile('transactions', transactions);
  }

  // Stock Prices
  async getStockPrices(): Promise<Record<string, StockPrice>> {
    if (useDynamoDB()) {
      const prices = await this.dynamoQuery<StockPrice>('STOCK_PRICE');
      const result: Record<string, StockPrice> = {};
      prices.forEach(price => {
        result[price.symbol] = price;
      });
      return result;
    }
    return this.readFile<Record<string, StockPrice>>('stockPrices', {});
  }

  async getStockPrice(symbol: string): Promise<number | null> {
    if (useDynamoDB()) {
      const price = await this.dynamoGet<StockPrice>('STOCK_PRICE', symbol);
      return price?.price || null;
    }
    const prices = await this.getStockPrices();
    return prices[symbol]?.price || null;
  }

  async saveStockPrice(symbol: string, price: number): Promise<void> {
    if (useDynamoDB()) {
      const stockPrice: StockPrice = {
        symbol,
        price,
        lastUpdated: new Date().toISOString(),
      };
      await this.dynamoPut('STOCK_PRICE', symbol, stockPrice);
      return;
    }
    const prices = await this.getStockPrices();
    prices[symbol] = {
      symbol,
      price,
      lastUpdated: new Date().toISOString(),
    };
    this.writeFile('stockPrices', prices);
  }

  async saveStockPrices(prices: Record<string, StockPrice>): Promise<void> {
    if (useDynamoDB()) {
      for (const [symbol, price] of Object.entries(prices)) {
        await this.dynamoPut('STOCK_PRICE', symbol, price);
      }
      return;
    }
    this.writeFile('stockPrices', prices);
  }

  // Initial Positions
  async getInitialPositions(): Promise<InitialPosition[]> {
    if (useDynamoDB()) {
      return this.dynamoQuery<InitialPosition>('INITIAL_POSITION');
    }
    return this.readFile<InitialPosition[]>('initialPositions', []);
  }

  async getPlayerInitialPositions(playerId: string): Promise<InitialPosition[]> {
    if (useDynamoDB()) {
      return this.dynamoQuery<InitialPosition>('INITIAL_POSITION', `PLAYER#${playerId}#`);
    }
    const positions = await this.getInitialPositions();
    return positions.filter(p => p.playerId === playerId);
  }

  async saveInitialPosition(position: InitialPosition): Promise<void> {
    if (useDynamoDB()) {
      const sk = `PLAYER#${position.playerId}#${position.symbol}`;
      await this.dynamoPut('INITIAL_POSITION', sk, position);
      return;
    }
    const positions = await this.getInitialPositions();
    const filtered = positions.filter(
      p => !(p.playerId === position.playerId && p.symbol === position.symbol)
    );
    filtered.push(position);
    this.writeFile('initialPositions', filtered);
  }

  async clearPlayerInitialPositions(playerId: string): Promise<void> {
    if (useDynamoDB()) {
      const positions = await this.getPlayerInitialPositions(playerId);
      for (const pos of positions) {
        await this.dynamoDelete('INITIAL_POSITION', `PLAYER#${playerId}#${pos.symbol}`);
      }
      return;
    }
    const positions = await this.getInitialPositions();
    const filtered = positions.filter(p => p.playerId !== playerId);
    this.writeFile('initialPositions', filtered);
  }

  // Portfolio Snapshots
  async getPortfolioSnapshots(): Promise<PortfolioSnapshot[]> {
    if (useDynamoDB()) {
      return this.dynamoQuery<PortfolioSnapshot>('PORTFOLIO_SNAPSHOT');
    }
    return this.readFile<PortfolioSnapshot[]>('portfolioSnapshots', []);
  }

  async getPlayerSnapshots(playerId: string): Promise<PortfolioSnapshot[]> {
    if (useDynamoDB()) {
      return this.dynamoQuery<PortfolioSnapshot>('PORTFOLIO_SNAPSHOT', `PLAYER#${playerId}#`);
    }
    const snapshots = await this.getPortfolioSnapshots();
    return snapshots.filter(s => s.playerId === playerId).sort((a, b) => a.date.localeCompare(b.date));
  }

  async savePortfolioSnapshot(snapshot: PortfolioSnapshot): Promise<void> {
    if (useDynamoDB()) {
      const sk = `PLAYER#${snapshot.playerId}#${snapshot.date}`;
      await this.dynamoPut('PORTFOLIO_SNAPSHOT', sk, snapshot);
      return;
    }
    const snapshots = await this.getPortfolioSnapshots();
    const filtered = snapshots.filter(
      s => !(s.playerId === snapshot.playerId && s.date === snapshot.date)
    );
    filtered.push(snapshot);
    this.writeFile('portfolioSnapshots', filtered);
  }

  // News Cache
  async getNewsCache(playerId: string): Promise<NewsCache | null> {
    if (useDynamoDB()) {
      return this.dynamoGet<NewsCache>('NEWS_CACHE', playerId);
    }
    const caches = this.readFile<Record<string, NewsCache>>('newsCache', {});
    return caches[playerId] || null;
  }

  async saveNewsCache(cache: NewsCache): Promise<void> {
    if (useDynamoDB()) {
      await this.dynamoPut('NEWS_CACHE', cache.playerId, cache);
      return;
    }
    const caches = this.readFile<Record<string, NewsCache>>('newsCache', {});
    caches[cache.playerId] = cache;
    this.writeFile('newsCache', caches);
  }

  // === LEDGER ENTRIES ===

  async getLedgerEntries(): Promise<LedgerEntry[]> {
    if (useDynamoDB()) {
      return this.dynamoQuery<LedgerEntry>('LEDGER');
    }
    return this.readFile<LedgerEntry[]>('ledger', []);
  }

  async getPlayerLedgerEntries(playerId: string): Promise<LedgerEntry[]> {
    if (useDynamoDB()) {
      return this.dynamoQuery<LedgerEntry>('LEDGER', `PLAYER#${playerId}#`);
    }
    const entries = await this.getLedgerEntries();
    return entries
      .filter(e => e.playerId === playerId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  async getLedgerEntriesForSymbol(playerId: string, symbol: string): Promise<LedgerEntry[]> {
    const entries = await this.getPlayerLedgerEntries(playerId);
    return entries.filter(e => e.symbol === symbol);
  }

  async saveLedgerEntry(entry: LedgerEntry): Promise<void> {
    if (useDynamoDB()) {
      const sk = `PLAYER#${entry.playerId}#TIME#${entry.timestamp}#${entry.id}`;
      await this.dynamoPut('LEDGER', sk, entry);
      return;
    }
    const entries = await this.getLedgerEntries();
    entries.push(entry);
    this.writeFile('ledger', entries);
  }

  async clearPlayerLedgerEntries(playerId: string): Promise<void> {
    if (useDynamoDB()) {
      const entries = await this.getPlayerLedgerEntries(playerId);
      for (const entry of entries) {
        await this.dynamoDelete('LEDGER', `PLAYER#${playerId}#TIME#${entry.timestamp}#${entry.id}`);
      }
      return;
    }
    const entries = await this.getLedgerEntries();
    const filtered = entries.filter(e => e.playerId !== playerId);
    this.writeFile('ledger', filtered);
  }

  // === POSITION SUMMARIES ===

  async getPositionSummaries(): Promise<PositionSummary[]> {
    if (useDynamoDB()) {
      return this.dynamoQuery<PositionSummary>('POSITION_SUMMARY');
    }
    return this.readFile<PositionSummary[]>('positionSummaries', []);
  }

  async getPlayerPositionSummaries(playerId: string): Promise<PositionSummary[]> {
    if (useDynamoDB()) {
      return this.dynamoQuery<PositionSummary>('POSITION_SUMMARY', `PLAYER#${playerId}#`);
    }
    const summaries = await this.getPositionSummaries();
    return summaries.filter(s => s.playerId === playerId);
  }

  async getPositionSummary(playerId: string, symbol: string): Promise<PositionSummary | null> {
    if (useDynamoDB()) {
      return this.dynamoGet<PositionSummary>('POSITION_SUMMARY', `PLAYER#${playerId}#SYMBOL#${symbol}`);
    }
    const summaries = await this.getPositionSummaries();
    return summaries.find(s => s.playerId === playerId && s.symbol === symbol) || null;
  }

  async savePositionSummary(summary: PositionSummary): Promise<void> {
    if (useDynamoDB()) {
      await this.dynamoPut('POSITION_SUMMARY', `PLAYER#${summary.playerId}#SYMBOL#${summary.symbol}`, summary);
      return;
    }
    const summaries = await this.getPositionSummaries();
    const index = summaries.findIndex(s => s.playerId === summary.playerId && s.symbol === summary.symbol);
    if (index >= 0) {
      summaries[index] = summary;
    } else {
      summaries.push(summary);
    }
    this.writeFile('positionSummaries', summaries);
  }

  async deletePositionSummary(playerId: string, symbol: string): Promise<void> {
    if (useDynamoDB()) {
      await this.dynamoDelete('POSITION_SUMMARY', `PLAYER#${playerId}#SYMBOL#${symbol}`);
      return;
    }
    const summaries = await this.getPositionSummaries();
    const filtered = summaries.filter(s => !(s.playerId === playerId && s.symbol === symbol));
    this.writeFile('positionSummaries', filtered);
  }

  async clearPlayerPositionSummaries(playerId: string): Promise<void> {
    if (useDynamoDB()) {
      const summaries = await this.getPlayerPositionSummaries(playerId);
      for (const summary of summaries) {
        await this.dynamoDelete('POSITION_SUMMARY', `PLAYER#${playerId}#SYMBOL#${summary.symbol}`);
      }
      return;
    }
    const summaries = await this.getPositionSummaries();
    const filtered = summaries.filter(s => s.playerId !== playerId);
    this.writeFile('positionSummaries', filtered);
  }

  // === PLAYER SUMMARIES ===

  async getPlayerSummaries(): Promise<PlayerSummary[]> {
    if (useDynamoDB()) {
      return this.dynamoQuery<PlayerSummary>('PLAYER_SUMMARY');
    }
    return this.readFile<PlayerSummary[]>('playerSummaries', []);
  }

  async getPlayerSummary(playerId: string): Promise<PlayerSummary | null> {
    if (useDynamoDB()) {
      return this.dynamoGet<PlayerSummary>('PLAYER_SUMMARY', playerId);
    }
    const summaries = await this.getPlayerSummaries();
    return summaries.find(s => s.playerId === playerId) || null;
  }

  async savePlayerSummary(summary: PlayerSummary): Promise<void> {
    if (useDynamoDB()) {
      await this.dynamoPut('PLAYER_SUMMARY', summary.playerId, summary);
      return;
    }
    const summaries = await this.getPlayerSummaries();
    const index = summaries.findIndex(s => s.playerId === summary.playerId);
    if (index >= 0) {
      summaries[index] = summary;
    } else {
      summaries.push(summary);
    }
    this.writeFile('playerSummaries', summaries);
  }

  async deletePlayerSummary(playerId: string): Promise<void> {
    if (useDynamoDB()) {
      await this.dynamoDelete('PLAYER_SUMMARY', playerId);
      return;
    }
    const summaries = await this.getPlayerSummaries();
    const filtered = summaries.filter(s => s.playerId !== playerId);
    this.writeFile('playerSummaries', filtered);
  }
}

export const db = new Database();
