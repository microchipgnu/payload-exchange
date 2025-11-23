import { type Address, createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { TREASURY_WALLET_ADDRESS, USDC_CONTRACT_ADDRESS } from "@/lib/config";

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
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// Create public client for Base mainnet
function getPublicClient() {
  const rpcUrl = process.env.BASE_RPC_URL;
  return createPublicClient({
    chain: base,
    transport: rpcUrl ? http(rpcUrl) : http(),
  });
}

export interface TransactionVerificationResult {
  success: boolean;
  verified: boolean;
  error?: string;
  receipt?: {
    status: "success" | "reverted";
    from: Address;
    to: Address;
    transactionHash: string;
  };
}

/**
 * Verify that a USDC transfer transaction was successful on-chain
 */
export async function verifyUSDCTransfer(
  transactionHash: string,
  expectedFrom: Address,
  expectedTo: Address = TREASURY_WALLET_ADDRESS as Address,
  expectedAmount: bigint,
): Promise<TransactionVerificationResult> {
  try {
    const publicClient = getPublicClient();

    // Wait for transaction receipt on Base mainnet
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: transactionHash as `0x${string}`,
      timeout: 60_000, // 60 seconds timeout
    });

    // Check if transaction succeeded
    if (receipt.status === "reverted") {
      return {
        success: false,
        verified: false,
        error: "Transaction reverted",
        receipt: {
          status: "reverted",
          from: receipt.from,
          to: receipt.to || ("0x" as Address),
          transactionHash: receipt.transactionHash,
        },
      };
    }

    // Verify the transaction was to the USDC contract
    if (!receipt.to) {
      return {
        success: false,
        verified: false,
        error: "Transaction receipt missing 'to' address",
        receipt: {
          status: receipt.status,
          from: receipt.from,
          to: "0x" as Address,
          transactionHash: receipt.transactionHash,
        },
      };
    }

    if (receipt.to.toLowerCase() !== USDC_CONTRACT_ADDRESS.toLowerCase()) {
      return {
        success: false,
        verified: false,
        error: `Transaction was not sent to USDC contract. Expected ${USDC_CONTRACT_ADDRESS}, got ${receipt.to}`,
        receipt: {
          status: receipt.status,
          from: receipt.from,
          to: receipt.to,
          transactionHash: receipt.transactionHash,
        },
      };
    }

    // Get the transaction to check the data
    const transaction = await publicClient.getTransaction({
      hash: transactionHash as `0x${string}`,
    });

    // Verify the transaction was from the expected address
    if (transaction.from.toLowerCase() !== expectedFrom.toLowerCase()) {
      return {
        success: false,
        verified: false,
        error: `Transaction was not from expected address. Expected ${expectedFrom}, got ${transaction.from}`,
        receipt: {
          status: receipt.status,
          from: receipt.from,
          to: receipt.to || ("0x" as Address),
          transactionHash: receipt.transactionHash,
        },
      };
    }

    // Decode the transaction data to verify transfer parameters
    // We'll use a simpler approach: check the treasury wallet balance before and after
    // Actually, let's check the logs for Transfer events
    const transferLogs = receipt.logs.filter((log) => {
      // USDC Transfer event signature: Transfer(address indexed from, address indexed to, uint256 value)
      // Event signature hash: keccak256("Transfer(address,address,uint256)") = 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
      return (
        log.topics[0] ===
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
      );
    });

    // Find the transfer log that matches our expected transfer
    const matchingTransfer = transferLogs.find((log) => {
      // topics[1] = from address (indexed, padded to 32 bytes)
      // topics[2] = to address (indexed, padded to 32 bytes)
      // Extract the last 40 hex characters (20 bytes = address length)
      if (!log.topics[1] || !log.topics[2]) return false;

      const fromTopic = log.topics[1];
      const toTopic = log.topics[2];

      // Ensure topics are 66 chars (0x + 64 hex chars)
      if (fromTopic.length !== 66 || toTopic.length !== 66) return false;

      // Extract address (last 40 hex chars after 0x)
      const fromAddress = `0x${fromTopic.slice(-40)}` as Address;
      const toAddress = `0x${toTopic.slice(-40)}` as Address;

      return (
        fromAddress.toLowerCase() === expectedFrom.toLowerCase() &&
        toAddress.toLowerCase() === expectedTo.toLowerCase()
      );
    });

    if (!matchingTransfer) {
      return {
        success: false,
        verified: false,
        error: "No matching USDC transfer event found in transaction logs",
        receipt: {
          status: receipt.status,
          from: receipt.from,
          to: receipt.to || ("0x" as Address),
          transactionHash: receipt.transactionHash,
        },
      };
    }

    // Decode the transfer amount from the log data
    // The data field contains the amount (uint256 = 32 bytes = 64 hex chars)
    // Remove '0x' prefix if present
    const dataHex = matchingTransfer.data.startsWith("0x")
      ? matchingTransfer.data.slice(2)
      : matchingTransfer.data;
    const transferredAmount = BigInt(`0x${dataHex}`);

    // Verify the amount matches
    if (transferredAmount !== expectedAmount) {
      return {
        success: false,
        verified: false,
        error: `Amount mismatch. Expected ${expectedAmount}, got ${transferredAmount}`,
        receipt: {
          status: receipt.status,
          from: receipt.from,
          to: receipt.to || ("0x" as Address),
          transactionHash: receipt.transactionHash,
        },
      };
    }

    // All checks passed
    return {
      success: true,
      verified: true,
      receipt: {
        status: receipt.status,
        from: receipt.from,
        to: receipt.to || ("0x" as Address),
        transactionHash: receipt.transactionHash,
      },
    };
  } catch (error) {
    return {
      success: false,
      verified: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error verifying transaction",
    };
  }
}

/**
 * Get the current USDC balance of an address on Base mainnet
 */
export async function getUSDCBalance(address: Address): Promise<bigint> {
  try {
    const publicClient = getPublicClient();
    const balance = await publicClient.readContract({
      address: USDC_CONTRACT_ADDRESS as Address,
      abi: USDC_ABI,
      functionName: "balanceOf",
      args: [address],
    });
    return balance;
  } catch (error) {
    console.error("Error getting USDC balance:", error);
    throw error;
  }
}
