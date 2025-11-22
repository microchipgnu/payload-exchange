"use client";

import { useEvmAddress, useIsSignedIn, type APIError } from "@coinbase/cdp-hooks";
import { SendEvmTransactionButton } from "@coinbase/cdp-react";
import { useEffect, useState } from "react";

export function SendTransaction() {
  const [isInIframe, setIsInIframe] = useState(false);

  useEffect(() => {
    setIsInIframe(window.self !== window.top);
  }, []);

  // Don't render in iframe
  if (isInIframe) {
    return null;
  }

  const { evmAddress } = useEvmAddress();
  const { isSignedIn } = useIsSignedIn();

  if (!isSignedIn || !evmAddress) {
    return null;
  }

  return (
    <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-3 space-y-3">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        Send Test Transaction
      </h3>
      <p className="text-xs text-slate-600 dark:text-slate-400">
        Send a small test transaction to your own address on Base Sepolia testnet
      </p>
      <SendEvmTransactionButton
        account={evmAddress}
        network="base-sepolia"
        transaction={{
          to: evmAddress,
          value: 1000000000000n, // 0.000001 ETH
          chainId: 84532, // Base Sepolia chain ID
          type: "eip1559",
        }}
        onSuccess={(hash: string) => {
          console.log("Transaction successful:", hash);
          alert(`Transaction sent! Hash: ${hash}`);
        }}
        onError={(error: APIError | Error) => {
          console.error("Transaction failed:", error);
          alert(`Transaction failed: ${error.message}`);
        }}
        pendingLabel="Sending transaction..."
      >
        <button className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm px-4 h-10">
          Send Test Transaction
        </button>
      </SendEvmTransactionButton>
    </div>
  );
}

