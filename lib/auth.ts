import bcrypt from 'bcryptjs';
import { db, Player } from './db';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function authenticatePlayer(name: string, password: string): Promise<Player | null> {
  const player = await db.getPlayerByName(name);
  if (!player) {
    return null;
  }

  const isValid = await verifyPassword(password, player.passwordHash);
  if (!isValid) {
    return null;
  }

  return player;
}

