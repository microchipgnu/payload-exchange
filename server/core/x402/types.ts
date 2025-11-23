// Re-export x402 types
import type { PaymentRequirements } from "x402/types";

/**
 * x402 Payment Required Response structure
 * See: https://github.com/coinbase/x402
 */
export interface X402PaymentRequiredResponse {
  x402Version: number;
  accepts?: PaymentRequirements[]; // Array of payment options
  paymentRequirements?: PaymentRequirements[]; // Alternative field name
}

/**
 * Parsed challenge for internal use
 * Maps from x402 Payment Required Response to our internal format
 */
export interface X402Challenge {
  amount: bigint; // smallest units (parsed from maxAmountRequired)
  currency: string; // Derived from scheme/network, e.g., 'USDC:base'
  network: string; // Blockchain network
  scheme: string; // Payment scheme
  resource: string; // Resource URL
  description?: string;
  mimeType?: string;
}

// Re-export PaymentRequirements for convenience
export type { PaymentRequirements };

export interface X402PaymentRequest {
  amount: bigint;
  currency: string;
  paymentPointer?: string;
  network?: string;
}

export interface X402PaymentResponse {
  success: boolean;
  transactionHash?: string;
  error?: string;
}
