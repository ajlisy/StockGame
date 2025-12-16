import { NextRequest, NextResponse } from 'next/server';
import { db, Player } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { createCashDeposit, createInitialPosition, clearPlayerLedgerData, recalculatePlayerSummary } from '@/lib/ledger';
import Papa from 'papaparse';

// Expected CSV format: Player, Symbol, Quantity, PurchasePrice, Date
interface CSVRow {
  Player: string;
  Symbol: string;
  Quantity: string;
  PurchasePrice: string;
  Date: string;
}

interface PositionData {
  symbol: string;
  quantity: number;
  purchasePrice: number;
  purchaseDate: string;
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
            const playersMap = new Map<string, { positions: PositionData[], totalCost: number, cash: number }>();
            const skippedRows: Array<{ row: number; reason: string; data: any }> = [];
            let processedRows = 0;

            console.log(`Processing ${rows.length} CSV rows...`);

            // Process CSV rows
            for (let i = 0; i < rows.length; i++) {
              const row = rows[i];
              const playerName = row.Player?.trim();
              const symbol = row.Symbol?.trim().toUpperCase();
              const quantityStr = row.Quantity?.trim() || '0';
              const purchasePriceStr = row.PurchasePrice?.trim() || '0';
              const quantity = parseInt(quantityStr);
              const purchasePrice = parseFloat(purchasePriceStr);
              const date = row.Date?.trim() || new Date().toISOString().split('T')[0];

              // Validate row
              if (!playerName) {
                skippedRows.push({ row: i + 2, reason: 'Missing player name', data: row });
                continue;
              }
              if (!symbol) {
                skippedRows.push({ row: i + 2, reason: 'Missing symbol', data: row });
                continue;
              }
              if (isNaN(quantity) || quantity <= 0) {
                skippedRows.push({ row: i + 2, reason: `Invalid quantity: "${quantityStr}"`, data: row });
                continue;
              }
              if (isNaN(purchasePrice) || purchasePrice <= 0) {
                skippedRows.push({ row: i + 2, reason: `Invalid purchase price: "${purchasePriceStr}"`, data: row });
                continue;
              }

              processedRows++;

              if (!playersMap.has(playerName)) {
                playersMap.set(playerName, { positions: [], totalCost: 0, cash: 0 });
              }

              const playerData = playersMap.get(playerName)!;

              // Handle $CASH as a special symbol for cash position
              if (symbol === '$CASH') {
                const cashAmount = quantity * purchasePrice;
                playerData.cash = cashAmount;
                playerData.totalCost += cashAmount;
                continue;
              }

              const cost = quantity * purchasePrice;
              playerData.totalCost += cost;

              playerData.positions.push({
                symbol,
                quantity,
                purchasePrice,
                purchaseDate: date,
              });
            }

            console.log(`Processed ${processedRows} valid rows, skipped ${skippedRows.length} rows`);
            if (skippedRows.length > 0) {
              console.log('Skipped rows:', skippedRows);
            }

            if (playersMap.size === 0) {
              resolve(NextResponse.json(
                {
                  error: 'No valid data found in CSV. Please check the format and ensure all required fields are present.',
                  details: skippedRows.length > 0 ? `Skipped ${skippedRows.length} rows. First few: ${JSON.stringify(skippedRows.slice(0, 3))}` : 'No rows could be processed.'
                },
                { status: 400 }
              ));
              return;
            }

            // Create or update players and ledger entries
            const createdPlayers: string[] = [];
            const cashReport: Record<string, { initialTotalValue: number; stockValue: number; cash: number }> = {};
            const errors: string[] = [];

            for (const [playerName, playerData] of Array.from(playersMap.entries())) {
              try {
                console.log(`Processing player: ${playerName}`);
                let player = await db.getPlayerByName(playerName);

                const initialTotalValue = playerData.totalCost;
                const stockValue = initialTotalValue - playerData.cash;
                const currentCash = playerData.cash;

                cashReport[playerName] = {
                  initialTotalValue,
                  stockValue,
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
                    createdAt: new Date().toISOString(),
                  };
                  await db.savePlayer(player);
                  createdPlayers.push(playerName);
                }

                // Clear existing ledger data for this player
                await clearPlayerLedgerData(player.id);

                // Create cash deposit entry
                if (currentCash > 0) {
                  await createCashDeposit(player.id, currentCash, 'Initial cash from CSV import');
                }

                // Create buy entries for each stock position
                for (const position of playerData.positions) {
                  try {
                    await createInitialPosition(
                      player.id,
                      position.symbol,
                      position.quantity,
                      position.purchasePrice,
                      position.purchaseDate,
                      'Initial import from CSV'
                    );
                  } catch (posError: any) {
                    const errorMsg = `Error saving position ${position.symbol} for ${playerName}: ${posError?.message || String(posError)}`;
                    console.error(errorMsg, posError);
                    errors.push(errorMsg);
                  }
                }

                // Recalculate player summary after all entries are created
                await recalculatePlayerSummary(player.id);

                console.log(`Completed processing player: ${playerName}`);
              } catch (playerError: any) {
                const errorMsg = `Error processing player ${playerName}: ${playerError?.message || String(playerError)}`;
                console.error(errorMsg, playerError);
                errors.push(errorMsg);
              }
            }

            if (errors.length > 0) {
              resolve(NextResponse.json({
                success: false,
                error: 'Some errors occurred during processing',
                errors,
                message: `Uploaded ${processedRows} positions for ${playersMap.size} players, but encountered ${errors.length} error(s)`,
                players: Array.from(playersMap.keys()),
                createdPlayers,
                cashReport,
                skippedRows: skippedRows.length > 0 ? skippedRows.slice(0, 10) : undefined,
              }, { status: 207 }));
              return;
            }

            resolve(NextResponse.json({
              success: true,
              message: `Successfully uploaded ${processedRows} positions for ${playersMap.size} player(s)`,
              players: Array.from(playersMap.keys()),
              createdPlayers,
              cashReport,
              skippedRows: skippedRows.length > 0 ? skippedRows.slice(0, 10) : undefined,
              stats: {
                totalRows: rows.length,
                processedRows,
                skippedRows: skippedRows.length,
                playersCreated: createdPlayers.length,
                playersUpdated: playersMap.size - createdPlayers.length,
              }
            }));
          } catch (error: any) {
            const errorMessage = error?.message || String(error);
            const errorStack = error?.stack;
            console.error('CSV processing error:', errorMessage);
            console.error('Error stack:', errorStack);
            console.error('Full error:', error);

            resolve(NextResponse.json(
              {
                error: 'Error processing CSV file',
                details: errorMessage,
                ...(process.env.NODE_ENV === 'development' && { stack: errorStack })
              },
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
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    const errorStack = error?.stack;
    console.error('Upload error:', errorMessage);
    console.error('Error stack:', errorStack);
    console.error('Full error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: errorMessage,
        ...(process.env.NODE_ENV === 'development' && { stack: errorStack })
      },
      { status: 500 }
    );
  }
}
