#!/usr/bin/env bun

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { formatEther } from "viem";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

/**
 * Script to create a new Ethereum account using viem
 * 
 * Usage:
 *   bun run scripts/create-account.ts
 *   or
 *   bun scripts/create-account.ts
 */

async function main() {
  console.log("🔐 Generating new Ethereum account...\n");

  // Generate a random private key
  const privateKey = generatePrivateKey();
  
  // Create an account from the private key
  const account = privateKeyToAccount(privateKey);
  
  console.log("✅ Account created successfully!\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📋 Account Details:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Address:     ${account.address}`);
  console.log(`Private Key: ${privateKey}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Try to fetch balance on Base network
  try {
    const publicClient = createPublicClient({
      transport: http(),
      chain: base,
    });

    const balance = await publicClient.getBalance({
      address: account.address,
    });

    console.log(`💰 Balance on Base: ${formatEther(balance)} ETH\n`);
  } catch (error) {
    console.log("⚠️  Could not fetch balance (network may be unavailable)\n");
  }

  console.log("⚠️  SECURITY WARNING:");
  console.log("   - Keep your private key secure and never share it");
  console.log("   - Never commit your private key to version control");
  console.log("   - Consider using environment variables or a secure vault");
  console.log("   - This account has no funds by default\n");
}

main().catch((error) => {
  console.error("❌ Error creating account:", error);
  process.exit(1);
});

