"use client";

import {
  type APIError,
  useEvmAddress,
  useIsSignedIn,
} from "@coinbase/cdp-hooks";
import { SendEvmTransactionButton } from "@coinbase/cdp-react";
import { base } from "viem/chains";

export function SendTransaction() {
  const { evmAddress } = useEvmAddress();
  const { isSignedIn } = useIsSignedIn();

  if (!isSignedIn || !evmAddress) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="font-semibold text-slate-900 text-sm dark:text-slate-100">
        Send Test Transaction
      </h3>
      <p className="text-slate-600 text-xs dark:text-slate-400">
        Send a small test transaction to your own address on Base
      </p>
      <SendEvmTransactionButton
        account={evmAddress}
        network="base"
        onError={(error: APIError | Error) => {
          console.error("Transaction failed:", error);
          alert(`Transaction failed: ${error.message}`);
        }}
        onSuccess={(hash: string) => {
          console.log("Transaction successful:", hash);
          alert(`Transaction sent! Hash: ${hash}`);
        }}
        pendingLabel="Sending transaction..."
        transaction={{
          to: evmAddress,
          value: 1000000000000n, // 0.000001 ETH
          chainId: base.id,
          type: "eip1559",
        }}
      >
        <button
          className="flex h-10 items-center justify-center gap-2 rounded-full border border-transparent border-solid bg-foreground px-4 font-medium text-background text-sm transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          type="button"
        >
          Send Test Transaction
        </button>
      </SendEvmTransactionButton>
    </div>
  );
}
