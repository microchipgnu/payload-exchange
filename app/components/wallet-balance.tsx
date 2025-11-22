"use client";

import { useEvmAddress, useIsSignedIn, useSolanaAddress } from "@coinbase/cdp-hooks";
import { useEffect, useState } from "react";
import { formatEther, formatUnits } from "viem";

interface Balance {
  value: bigint;
  formatted: string;
  isLoading: boolean;
  error: string | null;
}

export function WalletBalance() {
  const [isInIframe, setIsInIframe] = useState(false);
  const [evmBalance, setEvmBalance] = useState<Balance>({
    value: 0n,
    formatted: "0",
    isLoading: false,
    error: null,
  });
  const [solanaBalance, setSolanaBalance] = useState<Balance>({
    value: 0n,
    formatted: "0",
    isLoading: false,
    error: null,
  });

  // Always call hooks at the top level
  const { evmAddress } = useEvmAddress();
  const { solanaAddress } = useSolanaAddress();
  const { isSignedIn } = useIsSignedIn();

  useEffect(() => {
    setIsInIframe(window.self !== window.top);
  }, []);

  // Don't render in iframe
  if (isInIframe) {
    return null;
  }

  // Fetch EVM balance
  useEffect(() => {
    if (!isSignedIn || !evmAddress) {
      setEvmBalance({
        value: 0n,
        formatted: "0",
        isLoading: false,
        error: null,
      });
      return;
    }

    const fetchEvmBalance = async () => {
      setEvmBalance((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        // Use Base Sepolia public RPC
        const response = await fetch(
          "https://sepolia.base.org",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              jsonrpc: "2.0",
              method: "eth_getBalance",
              params: [evmAddress, "latest"],
              id: 1,
            }),
          }
        );

        const data = await response.json();
        if (data.error) {
          throw new Error(data.error.message || "Failed to fetch balance");
        }

        const balance = BigInt(data.result);
        setEvmBalance({
          value: balance,
          formatted: formatEther(balance),
          isLoading: false,
          error: null,
        });
      } catch (error) {
        setEvmBalance({
          value: 0n,
          formatted: "0",
          isLoading: false,
          error: error instanceof Error ? error.message : "Failed to fetch balance",
        });
      }
    };

    fetchEvmBalance();
    // Refresh balance every 10 seconds
    const interval = setInterval(fetchEvmBalance, 10000);
    return () => clearInterval(interval);
  }, [isSignedIn, evmAddress]);

  // Fetch Solana balance
  useEffect(() => {
    if (!isSignedIn || !solanaAddress) {
      setSolanaBalance({
        value: 0n,
        formatted: "0",
        isLoading: false,
        error: null,
      });
      return;
    }

    const fetchSolanaBalance = async () => {
      setSolanaBalance((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        // Use Solana devnet public RPC
        const response = await fetch(
          "https://api.devnet.solana.com",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "getBalance",
              params: [solanaAddress],
            }),
          }
        );

        const data = await response.json();
        if (data.error) {
          throw new Error(data.error.message || "Failed to fetch balance");
        }

        const balance = BigInt(data.result.value);
        // Solana uses lamports (1 SOL = 1e9 lamports)
        setSolanaBalance({
          value: balance,
          formatted: formatUnits(balance, 9),
          isLoading: false,
          error: null,
        });
      } catch (error) {
        setSolanaBalance({
          value: 0n,
          formatted: "0",
          isLoading: false,
          error: error instanceof Error ? error.message : "Failed to fetch balance",
        });
      }
    };

    fetchSolanaBalance();
    // Refresh balance every 10 seconds
    const interval = setInterval(fetchSolanaBalance, 10000);
    return () => clearInterval(interval);
  }, [isSignedIn, solanaAddress]);

  if (!isSignedIn) {
    return null;
  }

  return (
    <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-3 space-y-3">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        Wallet Balances
      </h3>
      <div className="space-y-2">
        {evmAddress && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span className="text-xs text-slate-600 dark:text-slate-400">
                Base Sepolia ETH:
              </span>
            </div>
            <div className="text-right">
              {evmBalance.isLoading ? (
                <span className="text-xs text-slate-500 dark:text-slate-400 animate-pulse">
                  Loading...
                </span>
              ) : evmBalance.error ? (
                <span className="text-xs text-red-500 dark:text-red-400">
                  Error
                </span>
              ) : (
                <span className="text-sm font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {parseFloat(evmBalance.formatted).toFixed(6)} ETH
                </span>
              )}
            </div>
          </div>
        )}
        {solanaAddress && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
              <span className="text-xs text-slate-600 dark:text-slate-400">
                Solana Devnet SOL:
              </span>
            </div>
            <div className="text-right">
              {solanaBalance.isLoading ? (
                <span className="text-xs text-slate-500 dark:text-slate-400 animate-pulse">
                  Loading...
                </span>
              ) : solanaBalance.error ? (
                <span className="text-xs text-red-500 dark:text-red-400">
                  Error
                </span>
              ) : (
                <span className="text-sm font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {parseFloat(solanaBalance.formatted).toFixed(6)} SOL
                </span>
              )}
            </div>
          </div>
        )}
        {!evmAddress && !solanaAddress && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No wallets available
          </p>
        )}
      </div>
    </div>
  );
}

