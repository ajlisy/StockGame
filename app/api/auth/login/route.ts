import { NextRequest, NextResponse } from 'next/server';
import { authenticatePlayer } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { name, password } = await request.json();

    if (!name || !password) {
      return NextResponse.json(
        { error: 'Name and password are required' },
        { status: 400 }
      );
    }

    const player = await authenticatePlayer(name, password);

    if (!player) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Create a simple session (in production, use proper session management)
    const response = NextResponse.json({ 
      success: true, 
      player: { id: player.id, name: player.name } 
    });

    // Set a cookie with player ID (simple approach - use proper sessions in production)
    response.cookies.set('playerId', player.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const playerId = request.cookies.get('playerId')?.value;
  
  if (!playerId) {
    return NextResponse.json({ authenticated: false });
  }

  const { db } = await import('@/lib/db');
  const player = await db.getPlayer(playerId);

  if (!player) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({ 
    authenticated: true,
    player: { id: player.id, name: player.name }
  });
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete('playerId');
  return response;
}

