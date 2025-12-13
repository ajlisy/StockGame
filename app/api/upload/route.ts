import { NextRequest, NextResponse } from 'next/server';
import { db, Player, Position } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import Papa from 'papaparse';

// Expected CSV format: Player, Symbol, Quantity, PurchasePrice, Date
interface CSVRow {
  Player: string;
  Symbol: string;
  Quantity: string;
  PurchasePrice: string;
  Date: string;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    const text = await file.text();
    
    return new Promise<NextResponse>((resolve) => {
      Papa.parse<CSVRow>(text, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            const rows = results.data;
            const playersMap = new Map<string, { positions: Position[], totalCost: number, cash: number }>();

            // Process CSV rows
            for (const row of rows) {
              const playerName = row.Player?.trim();
              const symbol = row.Symbol?.trim().toUpperCase();
              const quantity = parseInt(row.Quantity?.trim() || '0');
              const purchasePrice = parseFloat(row.PurchasePrice?.trim() || '0');
              const date = row.Date?.trim() || '2024-12-07';

              if (!playerName || !symbol || quantity <= 0 || purchasePrice <= 0) {
                continue;
              }

              if (!playersMap.has(playerName)) {
                playersMap.set(playerName, { positions: [], totalCost: 0, cash: 0 });
              }

              const playerData = playersMap.get(playerName)!;

              // Handle $CASH as a special symbol for cash position
              if (symbol === '$CASH') {
                const cashAmount = quantity * purchasePrice;
                playerData.cash = cashAmount;
                playerData.totalCost += cashAmount; // Cash counts toward initial total value
                continue; // Don't create a position for cash
              }

              const cost = quantity * purchasePrice;
              playerData.totalCost += cost;

              const position: Position = {
                id: `${Date.now()}-${Math.random()}-${symbol}`,
                playerId: '', // Will be set after player is created
                symbol,
                quantity,
                purchasePrice,
                purchaseDate: date,
                createdAt: new Date().toISOString(),
              };
              playerData.positions.push(position);
            }

            // Create or update players and positions
            const createdPlayers: string[] = [];
            const cashReport: Record<string, { initialTotalValue: number; stockValue: number; cash: number }> = {};

            for (const [playerName, playerData] of Array.from(playersMap.entries())) {
              let player = db.getPlayerByName(playerName);

              // Starting cash = total initial value (all stock positions + cash)
              const initialTotalValue = playerData.totalCost;
              const stockValue = initialTotalValue - playerData.cash;
              const currentCash = playerData.cash;

              cashReport[playerName] = {
                initialTotalValue: initialTotalValue,
                stockValue: stockValue,
                cash: currentCash
              };

              console.log(`${playerName}: Initial Total Value $${initialTotalValue.toFixed(2)} (Stocks: $${stockValue.toFixed(2)}, Cash: $${currentCash.toFixed(2)})`);

              if (!player) {
                // Create new player with default password
                const defaultPassword = await hashPassword('changeme');
                player = {
                  id: `player-${Date.now()}-${Math.random()}`,
                  name: playerName,
                  passwordHash: defaultPassword,
                  startingCash: initialTotalValue, // Total initial value (stocks + cash)
                  currentCash: currentCash, // Cash position from CSV
                  createdAt: new Date().toISOString(),
                };
                db.savePlayer(player);
                createdPlayers.push(playerName);
              } else {
                // Update existing player
                player.startingCash = initialTotalValue;
                player.currentCash = currentCash;
                db.savePlayer(player);
              }

              // Delete existing positions for this player before adding new ones
              // (This ensures a clean upload of initial positions)
              const existingPositions = db.getPlayerPositions(player.id);
              for (const existingPos of existingPositions) {
                db.deletePosition(existingPos.id);
              }

              // Save new positions
              for (const position of playerData.positions) {
                position.playerId = player.id;
                db.savePosition(position);
              }
            }

            resolve(NextResponse.json({
              success: true,
              message: `Uploaded ${rows.length} positions for ${playersMap.size} players`,
              players: Array.from(playersMap.keys()),
              createdPlayers,
              cashReport,
            }));
          } catch (error) {
            console.error('CSV processing error:', error);
            resolve(NextResponse.json(
              { error: 'Error processing CSV file' },
              { status: 500 }
            ));
          }
        },
        error: (error: Error) => {
          resolve(NextResponse.json(
            { error: `CSV parsing error: ${error.message}` },
            { status: 400 }
          ));
        },
      });
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

