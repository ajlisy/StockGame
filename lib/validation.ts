import { db, Player, Position } from './db';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateTrade(
  player: Player,
  symbol: string,
  type: 'BUY' | 'SELL',
  quantity: number,
  price: number
): ValidationResult {
  // Validate quantity
  if (quantity <= 0 || !Number.isInteger(quantity)) {
    return { valid: false, error: 'Quantity must be a positive integer' };
  }

  // Validate price
  if (price <= 0) {
    return { valid: false, error: 'Price must be positive' };
  }

  const totalAmount = quantity * price;

  if (type === 'BUY') {
    // Check if player has enough cash
    if (totalAmount > player.currentCash) {
      return { valid: false, error: 'Insufficient cash for this trade' };
    }

    // Check if player already owns a different stock
    const positions = db.getPlayerPositions(player.id);
    const otherPositions = positions.filter(p => p.symbol !== symbol);
    
    if (otherPositions.length > 0) {
      return { 
        valid: false, 
        error: 'You must sell your current stock before buying a different one' 
      };
    }
  } else if (type === 'SELL') {
    // Check if player owns this stock
    const positions = db.getPlayerPositions(player.id);
    const position = positions.find(p => p.symbol === symbol);
    
    if (!position) {
      return { valid: false, error: 'You do not own this stock' };
    }

    // Check if player has enough shares
    if (quantity > position.quantity) {
      return { valid: false, error: 'Insufficient shares to sell' };
    }
  }

  return { valid: true };
}

