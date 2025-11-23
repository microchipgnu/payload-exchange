"use client";

import { useEvmAddress, useIsSignedIn } from "@coinbase/cdp-hooks";

export function FundFaucet() {
  const { evmAddress } = useEvmAddress();
  const { isSignedIn } = useIsSignedIn();

  if (!(isSignedIn && evmAddress)) {
    return null;
  }

  // CDP Faucet URL - users can request testnet funds here
  const faucetUrl = `https://portal.cdp.coinbase.com/products/faucet?address=${encodeURIComponent(evmAddress)}`;

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="font-semibold text-slate-900 text-sm dark:text-slate-100">
        Get Testnet Funds
      </h3>
      <p className="text-slate-600 text-xs dark:text-slate-400">
        Fund your wallet with free testnet ETH from the Base Sepolia faucet
      </p>
      <a
        className="flex h-10 w-full items-center justify-center gap-2 rounded-full border border-transparent border-solid bg-foreground px-4 font-medium text-background text-sm transition-colors hover:bg-[#383838] sm:w-auto dark:hover:bg-[#ccc]"
        href={faucetUrl}
        rel="noopener noreferrer"
        target="_blank"
      >
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
          />
        </svg>
        Request Faucet Funds
      </a>
      <div className="rounded bg-slate-100 px-2 py-1.5 dark:bg-slate-800">
        <p className="mb-1 text-slate-500 text-xs dark:text-slate-400">
          Your address:
        </p>
        <p className="break-all font-mono text-slate-700 text-xs dark:text-slate-300">
          {evmAddress}
        </p>
      </div>
    </div>
  );
}
