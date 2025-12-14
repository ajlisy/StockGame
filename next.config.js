/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Expose server-side environment variables to all API routes
  env: {
    AWS_REGION: process.env.AWS_REGION,
    DYNAMODB_TABLE_NAME: process.env.DYNAMODB_TABLE_NAME,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  },
}

module.exports = nextConfig

