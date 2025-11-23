import { DEPLOYMENT_URL } from "vercel-url";

export const APP_BASE_URL = process.env.TUNNEL_URL || DEPLOYMENT_URL;

export const DATABASE_URL = process.env.DATABASE_URL || "";

export const X402_ENDPOINT = process.env.X402_ENDPOINT || "";

export const TREASURY_WALLET_ADDRESS =
  process.env.TREASURY_WALLET_ADDRESS ||
  "0x0000000000000000000000000000000000000000";

// USDC contract address on Base mainnet
export const USDC_CONTRACT_ADDRESS =
  process.env.USDC_CONTRACT_ADDRESS ||
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// VLayer configuration
export const VLAYER_API_ENDPOINT = process.env.VLAYER_API_ENDPOINT || "";
export const VLAYER_CLIENT_ID = process.env.VLAYER_CLIENT_ID || "";
export const VLAYER_BEARER_TOKEN = process.env.VLAYER_BEARER_TOKEN || "";
