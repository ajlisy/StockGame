import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import fs from 'fs';
import path from 'path';

// Use DynamoDB in production (AWS), file system in local development
const USE_DYNAMODB = !!(process.env.AWS_REGION && process.env.DYNAMODB_TABLE_NAME);
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'stock-competition';
const REGION = process.env.AWS_REGION || 'us-east-1';

// Log storage mode for debugging
console.log(`[DB] Storage mode: ${USE_DYNAMODB ? 'DynamoDB' : 'File System'}`);
console.log(`[DB] AWS_REGION: ${process.env.AWS_REGION || 'not set'}`);
console.log(`[DB] DYNAMODB_TABLE_NAME: ${process.env.DYNAMODB_TABLE_NAME || 'not set'}`);

// Initialize DynamoDB client
let dynamoClient: DynamoDBDocumentClient | null = null;
if (USE_DYNAMODB) {
  const client = new DynamoDBClient({ region: REGION });
  dynamoClient = DynamoDBDocumentClient.from(client);
}

// File system fallback for local development
const DATA_DIR = path.join(process.cwd(), 'data');
if (!USE_DYNAMODB && !fs.existsSync(DATA_DIR)) {
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
  // DynamoDB methods
  private async dynamoGet<T>(pk: string, sk: string): Promise<T | null> {
    if (!dynamoClient) return null;
    try {
      const result = await dynamoClient.send(
        new GetCommand({
          TableName: TABLE_NAME,
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
    if (!dynamoClient) return;
    try {
      await dynamoClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: { pk, sk, data },
        })
      );
    } catch (error) {
      console.error('DynamoDB put error:', error);
      throw error;
    }
  }

  private async dynamoQuery<T>(pk: string, skPrefix?: string): Promise<T[]> {
    if (!dynamoClient) return [];
    try {
      const params: any = {
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': pk },
      };

      if (skPrefix) {
        params.KeyConditionExpression += ' AND begins_with(sk, :skPrefix)';
        params.ExpressionAttributeValues[':skPrefix'] = skPrefix;
      }

      const result = await dynamoClient.send(new QueryCommand(params));
      return (result.Items || []).map(item => item.data as T);
    } catch (error) {
      console.error('DynamoDB query error:', error);
      return [];
    }
  }

  private async dynamoScan<T>(pkPrefix: string): Promise<T[]> {
    if (!dynamoClient) return [];
    try {
      const result = await dynamoClient.send(
        new ScanCommand({
          TableName: TABLE_NAME,
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
    if (!dynamoClient) return;
    try {
      await dynamoClient.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
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
  async getPlayers(): Promise<Player[]> {
    if (USE_DYNAMODB) {
      return this.dynamoQuery<Player>('PLAYER');
    }
    return this.readFile<Player[]>('players', []);
  }

  async getPlayer(id: string): Promise<Player | null> {
    if (USE_DYNAMODB) {
      return this.dynamoGet<Player>('PLAYER', id);
    }
    const players = await this.getPlayers();
    return players.find(p => p.id === id) || null;
  }

  async getPlayerByName(name: string): Promise<Player | null> {
    if (USE_DYNAMODB) {
      const players = await this.getPlayers();
      return players.find(p => p.name.toLowerCase() === name.toLowerCase()) || null;
    }
    const players = await this.getPlayers();
    return players.find(p => p.name.toLowerCase() === name.toLowerCase()) || null;
  }

  async savePlayer(player: Player): Promise<void> {
    if (USE_DYNAMODB) {
      await this.dynamoPut('PLAYER', player.id, player);
      return;
    }
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
    if (USE_DYNAMODB) {
      return this.dynamoQuery<Position>('POSITION');
    }
    return this.readFile<Position[]>('positions', []);
  }

  async getPlayerPositions(playerId: string): Promise<Position[]> {
    if (USE_DYNAMODB) {
      return this.dynamoQuery<Position>('POSITION', `PLAYER#${playerId}#`);
    }
    const positions = await this.getPositions();
    return positions.filter(p => p.playerId === playerId);
  }

  async savePosition(position: Position): Promise<void> {
    if (USE_DYNAMODB) {
      await this.dynamoPut('POSITION', `PLAYER#${position.playerId}#${position.id}`, position);
      return;
    }
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
    if (USE_DYNAMODB) {
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
    if (USE_DYNAMODB) {
      return this.dynamoQuery<Transaction>('TRANSACTION');
    }
    return this.readFile<Transaction[]>('transactions', []);
  }

  async getPlayerTransactions(playerId: string): Promise<Transaction[]> {
    if (USE_DYNAMODB) {
      return this.dynamoQuery<Transaction>('TRANSACTION', `PLAYER#${playerId}#`);
    }
    const transactions = await this.getTransactions();
    return transactions.filter(t => t.playerId === playerId);
  }

  async saveTransaction(transaction: Transaction): Promise<void> {
    if (USE_DYNAMODB) {
      await this.dynamoPut('TRANSACTION', `PLAYER#${transaction.playerId}#${transaction.id}`, transaction);
      return;
    }
    const transactions = await this.getTransactions();
    transactions.push(transaction);
    this.writeFile('transactions', transactions);
  }

  // Stock Prices
  async getStockPrices(): Promise<Record<string, StockPrice>> {
    if (USE_DYNAMODB) {
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
    if (USE_DYNAMODB) {
      const price = await this.dynamoGet<StockPrice>('STOCK_PRICE', symbol);
      return price?.price || null;
    }
    const prices = await this.getStockPrices();
    return prices[symbol]?.price || null;
  }

  async saveStockPrice(symbol: string, price: number): Promise<void> {
    if (USE_DYNAMODB) {
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
    if (USE_DYNAMODB) {
      for (const [symbol, price] of Object.entries(prices)) {
        await this.dynamoPut('STOCK_PRICE', symbol, price);
      }
      return;
    }
    this.writeFile('stockPrices', prices);
  }

  // Initial Positions
  async getInitialPositions(): Promise<InitialPosition[]> {
    if (USE_DYNAMODB) {
      return this.dynamoQuery<InitialPosition>('INITIAL_POSITION');
    }
    return this.readFile<InitialPosition[]>('initialPositions', []);
  }

  async getPlayerInitialPositions(playerId: string): Promise<InitialPosition[]> {
    if (USE_DYNAMODB) {
      return this.dynamoQuery<InitialPosition>('INITIAL_POSITION', `PLAYER#${playerId}#`);
    }
    const positions = await this.getInitialPositions();
    return positions.filter(p => p.playerId === playerId);
  }

  async saveInitialPosition(position: InitialPosition): Promise<void> {
    if (USE_DYNAMODB) {
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
    if (USE_DYNAMODB) {
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
    if (USE_DYNAMODB) {
      return this.dynamoQuery<PortfolioSnapshot>('PORTFOLIO_SNAPSHOT');
    }
    return this.readFile<PortfolioSnapshot[]>('portfolioSnapshots', []);
  }

  async getPlayerSnapshots(playerId: string): Promise<PortfolioSnapshot[]> {
    if (USE_DYNAMODB) {
      return this.dynamoQuery<PortfolioSnapshot>('PORTFOLIO_SNAPSHOT', `PLAYER#${playerId}#`);
    }
    const snapshots = await this.getPortfolioSnapshots();
    return snapshots.filter(s => s.playerId === playerId).sort((a, b) => a.date.localeCompare(b.date));
  }

  async savePortfolioSnapshot(snapshot: PortfolioSnapshot): Promise<void> {
    if (USE_DYNAMODB) {
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
}

export const db = new Database();
