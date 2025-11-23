"use client";

import {
  type APIError,
  useEvmAddress,
  useIsSignedIn,
  useSignOut,
} from "@coinbase/cdp-hooks";
import { SendEvmTransactionButton } from "@coinbase/cdp-react";
import { useCallback, useEffect, useState } from "react";
import { encodeFunctionData, parseUnits } from "viem";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WalletAuth } from "@/components/wallet-auth";
import { USDC_CONTRACT_ADDRESS } from "@/lib/config";

export default function SponsorBillingPage() {
  const { isSignedIn } = useIsSignedIn();
  const { evmAddress } = useEvmAddress();
  const { signOut } = useSignOut();
  const [balance, setBalance] = useState<string>("0");
  const [fundAmount, setFundAmount] = useState("");
  const [treasuryWallet, setTreasuryWallet] = useState<string>("");
  const [fundingTransactionId, setFundingTransactionId] = useState<string>("");
  const [isFunding, setIsFunding] = useState(false);

  const loadBalance = useCallback(async () => {
    if (!evmAddress) return;
    try {
      const res = await fetch("/api/payload/sponsors/analytics", {
        headers: {
          "x-wallet-address": evmAddress,
        },
      });
      const data = await res.json();
      setBalance(data.balance || "0");
    } catch (error) {
      console.error("Failed to load balance:", error);
    }
  }, [evmAddress]);

  useEffect(() => {
    if (evmAddress) {
      loadBalance();
    }
  }, [loadBalance, evmAddress]);

  const handleFundInit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evmAddress || !fundAmount) return;
    try {
      const amount = BigInt(parseFloat(fundAmount) * 1_000_000); // Convert to smallest units
      const res = await fetch("/api/payload/sponsors/fund", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": evmAddress,
        },
        body: JSON.stringify({
          amount: amount.toString(),
          currency: "USDC:base",
          network: "base",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.treasuryWallet) {
          setTreasuryWallet(data.treasuryWallet);
          setFundingTransactionId(data.fundingTransactionId);
          setIsFunding(true);
        } else if (data.transactionHash) {
          // Already completed
          setFundAmount("");
          setIsFunding(false);
          loadBalance();
          alert(`Funding successful! Transaction: ${data.transactionHash}`);
        }
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Failed to initialize funding");
      }
    } catch (error) {
      console.error("Failed to fund:", error);
      alert("Failed to initialize funding");
    }
  };

  const handleTransactionSuccess = async (hash: string) => {
    if (!evmAddress || !fundingTransactionId) return;
    try {
      const amount = BigInt(parseFloat(fundAmount) * 1_000_000);
      const res = await fetch("/api/payload/sponsors/fund", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": evmAddress,
        },
        body: JSON.stringify({
          amount: amount.toString(),
          transactionHash: hash,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setFundAmount("");
        setIsFunding(false);
        setTreasuryWallet("");
        setFundingTransactionId("");
        loadBalance();
        alert(`Funding successful! Transaction: ${hash}`);
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Failed to complete funding");
      }
    } catch (error) {
      console.error("Failed to complete funding:", error);
      alert("Failed to complete funding");
    }
  };

  const handleTransactionError = (error: APIError | Error) => {
    console.error("Transaction failed:", error);
    alert(`Transaction failed: ${error.message}`);
    setIsFunding(false);
  };

  if (!isSignedIn || !evmAddress) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Billing</h1>
        <Card>
          <CardContent className="pt-6">
            <WalletAuth />
          </CardContent>
        </Card>
      </div>
    );
  }

  const balanceUSD = (BigInt(balance) / BigInt(1_000_000)).toString();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold">Billing</h1>
          <div className="mt-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Wallet Address:
            </p>
            <p className="text-sm font-mono text-slate-900 dark:text-slate-100 break-all">
              {evmAddress}
            </p>
          </div>
        </div>
        <Button onClick={signOut} variant="outline">
          Sign Out
        </Button>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Current Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold">${balanceUSD} USDC</p>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Available for sponsoring actions
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fund Account</CardTitle>
        </CardHeader>
        <CardContent>
          {!isFunding ? (
            <form onSubmit={handleFundInit} className="space-y-4">
              <div>
                <Label>Amount (USDC)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  placeholder="10.00"
                  disabled={isFunding}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isFunding}>
                Initialize Funding
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800 dark:bg-blue-950">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  Send {fundAmount} USDC to treasury wallet
                </p>
                <div className="mt-2 space-y-1">
                  <div>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      Treasury Wallet:
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300 break-all font-mono">
                      {treasuryWallet}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      USDC Contract:
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300 break-all font-mono">
                      {USDC_CONTRACT_ADDRESS}
                    </p>
                  </div>
                </div>
              </div>
              <SendEvmTransactionButton
                account={evmAddress!}
                network="base-sepolia"
                onError={handleTransactionError}
                onSuccess={handleTransactionSuccess}
                pendingLabel="Sending transaction..."
                transaction={{
                  to: USDC_CONTRACT_ADDRESS as `0x${string}`,
                  value: 0n, // No native ETH sent for ERC20 transfers
                  data: encodeFunctionData({
                    abi: [
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
                    ],
                    functionName: "transfer",
                    args: [
                      treasuryWallet as `0x${string}`,
                      parseUnits(fundAmount, 6), // USDC has 6 decimals
                    ],
                  }),
                  chainId: 84_532, // Base Sepolia chain ID
                  type: "eip1559",
                }}
              >
                <Button type="button" className="w-full">
                  Send {fundAmount} USDC
                </Button>
              </SendEvmTransactionButton>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setIsFunding(false);
                  setTreasuryWallet("");
                  setFundingTransactionId("");
                }}
              >
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
