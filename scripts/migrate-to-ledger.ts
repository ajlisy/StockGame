/**
 * Migration Script: Migrate to Central Ledger System
 *
 * This script prepares the database for the new ledger-based system.
 * It clears old data (positions, transactions, initial positions) while
 * keeping player accounts intact.
 *
 * After running this script, re-import your CSV data using the admin page
 * to populate the new ledger structure.
 *
 * Usage:
 *   npx ts-node scripts/migrate-to-ledger.ts
 *
 * Or add to package.json:
 *   "scripts": { "migrate": "ts-node scripts/migrate-to-ledger.ts" }
 */

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

interface Player {
  id: string;
  name: string;
  passwordHash: string;
  startingCash?: number;
  currentCash?: number;
  createdAt: string;
}

function readJsonFile<T>(filename: string, defaultValue: T): T {
  const filePath = path.join(DATA_DIR, `${filename}.json`);
  if (!fs.existsSync(filePath)) {
    return defaultValue;
  }
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${filename}:`, error);
    return defaultValue;
  }
}

function writeJsonFile<T>(filename: string, data: T): void {
  const filePath = path.join(DATA_DIR, `${filename}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function deleteJsonFile(filename: string): void {
  const filePath = path.join(DATA_DIR, `${filename}.json`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`  Deleted ${filename}.json`);
  }
}

async function migrate() {
  console.log('========================================');
  console.log('Migration to Central Ledger System');
  console.log('========================================\n');

  // Check if data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    console.log('No data directory found. Nothing to migrate.\n');
    console.log('Run the app and upload a CSV to create initial ledger data.');
    return;
  }

  // Read existing players
  const players = readJsonFile<Player[]>('players', []);
  console.log(`Found ${players.length} players\n`);

  // Update player records (remove deprecated fields)
  console.log('Step 1: Updating player records...');
  const updatedPlayers: Player[] = players.map(player => ({
    id: player.id,
    name: player.name,
    passwordHash: player.passwordHash,
    createdAt: player.createdAt,
  }));
  writeJsonFile('players', updatedPlayers);
  console.log(`  Updated ${updatedPlayers.length} player records (removed startingCash, currentCash)\n`);

  // Clear old data files
  console.log('Step 2: Clearing old data files...');
  deleteJsonFile('positions');
  deleteJsonFile('transactions');
  deleteJsonFile('initialPositions');
  deleteJsonFile('portfolioSnapshots');
  console.log('');

  // Initialize new ledger files (empty)
  console.log('Step 3: Initializing new ledger files...');
  writeJsonFile('ledger', []);
  writeJsonFile('positionSummaries', []);
  writeJsonFile('playerSummaries', []);
  console.log('  Created ledger.json');
  console.log('  Created positionSummaries.json');
  console.log('  Created playerSummaries.json\n');

  console.log('========================================');
  console.log('Migration complete!');
  console.log('========================================\n');
  console.log('Next steps:');
  console.log('1. Start the development server: npm run dev');
  console.log('2. Go to the admin page: http://localhost:3000/admin');
  console.log('3. Upload your CSV file to populate the new ledger\n');
  console.log('Note: Player accounts have been preserved.');
  console.log('Default password for all accounts: changeme');
}

// Run migration
migrate().catch(console.error);
