import { NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

export async function GET() {
  const config = {
    storage: process.env.AWS_REGION && process.env.DYNAMODB_TABLE_NAME ? 'DynamoDB' : 'File System',
    AWS_REGION: process.env.AWS_REGION || 'not set',
    DYNAMODB_TABLE_NAME: process.env.DYNAMODB_TABLE_NAME || 'not set',
    NODE_ENV: process.env.NODE_ENV || 'not set',
  };

  // Test DynamoDB connection
  if (config.storage === 'DynamoDB') {
    try {
      const client = new DynamoDBClient({ region: process.env.AWS_REGION });
      const docClient = DynamoDBDocumentClient.from(client);

      // Try to write a test item
      await docClient.send(new PutCommand({
        TableName: process.env.DYNAMODB_TABLE_NAME!,
        Item: { pk: 'TEST', sk: 'connection-test', data: { timestamp: new Date().toISOString() } },
      }));

      // Try to read it back
      const result = await docClient.send(new GetCommand({
        TableName: process.env.DYNAMODB_TABLE_NAME!,
        Key: { pk: 'TEST', sk: 'connection-test' },
      }));

      // Count items by type
      const scanResult = await docClient.send(new ScanCommand({
        TableName: process.env.DYNAMODB_TABLE_NAME!,
        Select: 'COUNT',
      }));

      // Get sample of actual data
      const dataSample = await docClient.send(new ScanCommand({
        TableName: process.env.DYNAMODB_TABLE_NAME!,
        Limit: 20,
      }));

      return NextResponse.json({
        ...config,
        dynamoDBTest: 'SUCCESS',
        testItem: result.Item,
        totalItems: scanResult.Count,
        dataSample: dataSample.Items?.map(item => ({
          pk: item.pk,
          sk: item.sk,
          dataPreview: typeof item.data === 'object' ? Object.keys(item.data) : item.data,
        })),
      });
    } catch (error: any) {
      return NextResponse.json({
        ...config,
        dynamoDBTest: 'FAILED',
        error: error.message,
        errorName: error.name,
        errorCode: error.code || error.$metadata?.httpStatusCode,
      });
    }
  }

  return NextResponse.json(config);
}
