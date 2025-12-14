import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    storage: process.env.AWS_REGION && process.env.DYNAMODB_TABLE_NAME ? 'DynamoDB' : 'File System',
    AWS_REGION: process.env.AWS_REGION || 'not set',
    DYNAMODB_TABLE_NAME: process.env.DYNAMODB_TABLE_NAME || 'not set',
    NODE_ENV: process.env.NODE_ENV || 'not set',
  });
}
