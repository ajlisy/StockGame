# DynamoDB Setup for AWS Amplify

## What Changed

The database has been migrated from file-based storage to DynamoDB to support persistent storage in AWS Amplify's serverless environment.

## DynamoDB Table Structure

**Table Name:** `stock-competition` (or set via `DYNAMODB_TABLE_NAME` env var)

**Schema:**
- **Partition Key (pk):** String - entity type (e.g., "PLAYER", "POSITION", "TRANSACTION")
- **Sort Key (sk):** String - unique identifier
- **data:** JSON object containing the actual entity data

**Key Patterns:**
- Players: `pk="PLAYER"`, `sk=playerId`
- Positions: `pk="POSITION"`, `sk="PLAYER#playerId#positionId"`
- Transactions: `pk="TRANSACTION"`, `sk="PLAYER#playerId#transactionId"`
- Stock Prices: `pk="STOCK_PRICE"`, `sk=symbol`
- Initial Positions: `pk="INITIAL_POSITION"`, `sk="PLAYER#playerId#symbol"`
- Portfolio Snapshots: `pk="PORTFOLIO_SNAPSHOT"`, `sk="PLAYER#playerId#date"`

## AWS Amplify Environment Variables

In AWS Amplify Console → Your App → Environment variables, add:

1. **AWS_REGION** = `us-east-1` (or your DynamoDB table's region)
2. **DYNAMODB_TABLE_NAME** = `stock-competition` (or your table name)

## IAM Permissions

The Amplify service role needs the following DynamoDB permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": "arn:aws:dynamodb:REGION:ACCOUNT_ID:table/stock-competition"
    }
  ]
}
```

## Local Development

For local development, the app will automatically fall back to file-based storage in the `data/` directory if:
- `AWS_REGION` is not set, OR
- `DYNAMODB_TABLE_NAME` is not set

This means you can develop locally without DynamoDB, and it will use DynamoDB automatically when deployed to Amplify.

## Migration Notes

- All database methods are now async (return Promises)
- All API routes have been updated to use `await` for database operations
- The code automatically detects the environment and uses the appropriate storage method

## Testing

After deploying to Amplify:
1. Upload your CSV file via `/admin`
2. Data should persist across Lambda cold starts
3. Check CloudWatch logs if you encounter any DynamoDB errors

## Troubleshooting

**Data still disappears:**
- Verify IAM permissions are correctly attached to Amplify service role
- Check that `AWS_REGION` and `DYNAMODB_TABLE_NAME` are set in Amplify environment variables
- Verify the DynamoDB table exists in the correct region

**DynamoDB errors in logs:**
- Check IAM permissions
- Verify table name matches `DYNAMODB_TABLE_NAME` env var
- Ensure table has correct partition key (pk) and sort key (sk)

