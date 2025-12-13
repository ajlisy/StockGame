# Quick Start Guide

## For Local Development

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create data directory**
   ```bash
   mkdir -p data
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Upload initial positions**
   - Go to http://localhost:3000/admin
   - Upload your CSV file with initial positions from December 7th
   - Format: `Player, Symbol, Quantity, PurchasePrice, Date`

5. **Players can now login and trade**
   - Default password: `changeme`
   - Login at http://localhost:3000/login
   - Make trades at http://localhost:3000/trade

## For AWS Amplify Deployment

### Important Note About Data Persistence

⚠️ **The current JSON file storage is ephemeral in serverless environments.**

This means data will be lost when Lambda functions restart. For a production competition, you should:

1. **Quick Fix**: Use AWS Amplify's built-in storage (S3 + DynamoDB)
2. **Better Solution**: Migrate to DynamoDB (see migration guide below)

### Deployment Steps

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-repo>
   git push -u origin main
   ```

2. **Connect to AWS Amplify**
   - Go to https://console.aws.amazon.com/amplify
   - Click "New app" → "Host web app"
   - Connect your GitHub repository
   - Amplify will auto-detect Next.js

3. **Deploy**
   - Review build settings (should auto-detect from `amplify.yml`)
   - Click "Save and deploy"
   - Wait for build to complete (~5-10 minutes)

4. **After First Deploy**
   - Go to your site URL
   - Navigate to `/admin`
   - Upload your CSV file
   - **Note**: Data will persist during the session but may be lost on cold starts

### Recommended: Add DynamoDB for Persistence

For persistent storage, add DynamoDB:

1. In AWS Console, create a DynamoDB table:
   - Table name: `stock-competition`
   - Partition key: `type` (String)
   - Sort key: `id` (String)

2. Update `lib/db.ts` to use DynamoDB instead of JSON files

3. Add AWS credentials to Amplify environment variables

## CSV Format Example

```csv
Player, Symbol, Quantity, PurchasePrice, Date
John, AAPL, 10, 150.50, 2024-12-07
John, MSFT, 5, 380.25, 2024-12-07
Jane, GOOGL, 8, 140.75, 2024-12-07
Jane, TSLA, 3, 245.00, 2024-12-07
```

## Default Passwords

After CSV upload, players are created with password: `changeme`

**Important**: Players should change their passwords (password change functionality can be added).

## Troubleshooting

- **Stock prices not loading**: Check internet connection, Yahoo Finance may be rate-limited
- **CSV upload fails**: Verify CSV format matches exactly (case-sensitive headers)
- **Build fails on Amplify**: Check Node.js version (should be 18+)

