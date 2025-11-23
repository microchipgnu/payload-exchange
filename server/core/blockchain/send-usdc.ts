import {
  type Address,
  createWalletClient,
  encodeFunctionData,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { USDC_CONTRACT_ADDRESS } from "@/lib/config";

// USDC ERC20 ABI - only the functions we need
const USDC_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

/**
 * Send USDC from treasury wallet to a user address
 * @param toAddress - The recipient address
 * @param amount - The amount in USDC (with 6 decimals, e.g., 1000000 = 1 USDC)
 * @returns Transaction hash
 */
export async function sendUSDCToUser(
  toAddress: Address,
  amount: bigint,
): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
  try {
    const treasuryPrivateKey = process.env.TREASURY_PRIVATE_KEY;
    if (!treasuryPrivateKey) {
      console.error("[Send USDC] TREASURY_PRIVATE_KEY not configured");
      return {
        success: false,
        error: "Treasury wallet private key not configured",
      };
    }

    const rpcUrl = process.env.BASE_RPC_URL;
    const account = privateKeyToAccount(treasuryPrivateKey as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: rpcUrl ? http(rpcUrl) : http(),
    });

    console.log("[Send USDC] Preparing transfer", {
      from: account.address,
      to: toAddress,
      amount: amount.toString(),
      contract: USDC_CONTRACT_ADDRESS,
    });

    // Encode the transfer function call
    const data = encodeFunctionData({
      abi: USDC_ABI,
      functionName: "transfer",
      args: [toAddress, amount],
    });

    // Send the transaction
    const hash = await walletClient.sendTransaction({
      to: USDC_CONTRACT_ADDRESS as Address,
      data,
      value: 0n, // No native ETH sent for ERC20 transfers
    });

    console.log("[Send USDC] Transaction sent", {
      hash,
      from: account.address,
      to: toAddress,
      amount: amount.toString(),
    });

    return {
      success: true,
      transactionHash: hash,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[Send USDC] Error sending USDC:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
