"use client";

import { useEvmAddress, useIsSignedIn } from "@coinbase/cdp-hooks";
import { useEffect, useState } from "react";

export function FundFaucet() {
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

  // CDP Faucet URL - users can request testnet funds here
  const faucetUrl = `https://portal.cdp.coinbase.com/products/faucet?address=${encodeURIComponent(evmAddress)}`;

  return (
    <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-3 space-y-3">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        Get Testnet Funds
      </h3>
      <p className="text-xs text-slate-600 dark:text-slate-400">
        Fund your wallet with free testnet ETH from the Base Sepolia faucet
      </p>
      <a
        href={faucetUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm px-4 h-10 w-full sm:w-auto"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
          />
        </svg>
        Request Faucet Funds
      </a>
      <div className="bg-slate-100 dark:bg-slate-800 rounded px-2 py-1.5">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
          Your address:
        </p>
        <p className="text-xs font-mono text-slate-700 dark:text-slate-300 break-all">
          {evmAddress}
        </p>
      </div>
    </div>
  );
}

